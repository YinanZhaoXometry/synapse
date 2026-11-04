# frozen_string_literal: true

require "rails_helper"

RSpec.describe "GraphQL storage upload flow (epic P2-6 ticket 02)", type: :request do
  # The wire behavior of the presigned direct-upload flow (AD-13): the
  # createMaterialUpload mutation, the Material.downloadUrl field, and the
  # never-mounted direct-uploads route re-assertion (ticket 02 re-asserts
  # per its text; spec/routes/active_storage_route_guard_spec.rb is the
  # standing guard). No bytes and no network run here — presigning is pure
  # client-side v4 signing and minting the blob is a Postgres row; the real
  # bytes round-trip lives in spec/integration/storage_round_trip_spec.rb.
  # The commands underneath have their own direct spec
  # (spec/commands/storage/create_material_upload_command_spec.rb).

  # The password must be the harness's known one — token_for logs in over
  # HTTP against it (GraphqlSpecHelpers).
  let(:user) { create(:user, email: "storage-uploader@example.com", password: password) }
  let(:token) { token_for(user.email) }
  let(:material) { create(:material, user: user) }

  def upload_mutation(material_id: material.id, filename: "lecture.pdf",
                      content_type: "application/pdf", size: 1_234)
    <<~GRAPHQL
      mutation {
        createMaterialUpload(input: {
          materialId: "#{material_id}",
          filename: "#{filename}",
          contentType: "#{content_type}",
          size: #{size}
        }) { uploadUrl materialId expiresAt }
      }
    GRAPHQL
  end

  describe "the auth guard (kickoff delta 8)" do
    it "answers UNAUTHORIZED without a token" do
      expect(error_code(graphql(upload_mutation))).to eq("UNAUTHORIZED")
    end
  end

  describe "createMaterialUpload mutation" do
    it "returns a v4 presigned PUT over minio with the constant TTL, without the object key on the wire" do
      result = graphql(upload_mutation, token: token)
      payload = result.dig("data", "createMaterialUpload")

      query = URI.decode_www_form_component(payload["uploadUrl"])
      aggregate_failures do
        expect(query).to include("X-Amz-Algorithm=AWS4-HMAC-SHA256")
        expect(query).to include("X-Amz-Expires=900")
        expect(payload["materialId"]).to eq(material.id)
        expect(payload["expiresAt"]).to be_present
        # The object key rides the blob, never the wire (the command's
        # contract) — the signed URL carries it as an address, but no
        # payload field hands it to the client as data.
        expect(result["data"]["createMaterialUpload"].keys).to contain_exactly("uploadUrl", "materialId", "expiresAt")
      end

      blob = material.reload.original.blob
      expect(blob).to be_present
      expect(payload["uploadUrl"]).to include(blob.key)
    end

    it "validates with typed Failures and mints nothing (VALIDATION_FAILED)" do
      aggregate_failures do
        expect(error_code(graphql(upload_mutation(filename: "   "), token: token))).to eq("VALIDATION_FAILED")
        expect(error_code(graphql(upload_mutation(content_type: "application/zip"), token: token)))
          .to eq("VALIDATION_FAILED")
        expect(error_code(graphql(upload_mutation(size: 0), token: token))).to eq("VALIDATION_FAILED")
        expect(error_code(graphql(upload_mutation(size: Storage::MAX_UPLOAD_BYTES + 1), token: token)))
          .to eq("VALIDATION_FAILED")
      end

      expect(material.reload.original.attached?).to be(false)
      expect(ActiveStorage::Blob.where(filename: "lecture.pdf").count).to eq(0)
    end

    it "answers uniform NOT_FOUND for unknown, foreign, and malformed material ids (delta 2)" do
      foreign = create(:material, user: create(:user))

      aggregate_failures do
        expect(error_code(graphql(upload_mutation(material_id: SecureRandom.uuid), token: token)))
          .to eq("NOT_FOUND")
        expect(error_code(graphql(upload_mutation(material_id: foreign.id), token: token))).to eq("NOT_FOUND")
        expect(error_code(graphql(upload_mutation(material_id: "garbage"), token: token))).to eq("NOT_FOUND")
      end

      expect(foreign.reload.original.attached?).to be(false)
    end

    it "re-points the material's attachment on a re-upload (one live attachment)" do
      graphql(upload_mutation, token: token)
      second = graphql(upload_mutation(filename: "second.pdf"), token: token)

      expect(second.dig("data", "createMaterialUpload", "uploadUrl")).to be_present
      expect(ActiveStorage::Attachment.where(record: material).count).to eq(1)
    end
  end

  describe "the Material.downloadUrl field" do
    it "is null until the presign flow attaches a blob, then mints a v4 presigned GET per request" do
      before_upload = graphql(
        'query { material(id: "' + material.id + '") { downloadUrl } }', token: token
      )
      expect(before_upload.dig("data", "material", "downloadUrl")).to be_nil

      graphql(upload_mutation, token: token)

      minted = graphql(
        'query { material(id: "' + material.id + '") { downloadUrl } }', token: token
      )
      url = minted.dig("data", "material", "downloadUrl")

      aggregate_failures do
        expect(url).to be_present
        expect(URI.decode_www_form_component(url)).to include("X-Amz-Algorithm=AWS4-HMAC-SHA256")
        expect(URI.decode_www_form_component(url)).to include("X-Amz-Expires=300")
      end

      # Minted per request, never persisted (AD-13): a second read mints a
      # usable URL again, and nothing URL-shaped lives on the blob's row
      # (same-second presigns can legitimately produce the same bytes — the
      # signature covers key+expiry+signing time).
      reminted = graphql(
        'query { material(id: "' + material.id + '") { downloadUrl } }', token: token
      )
      expect(reminted.dig("data", "material", "downloadUrl")).to be_present
      blob_attributes = material.reload.original.blob.attributes.values.grep(String).join(" ")
      expect(blob_attributes).not_to include("X-Amz")
    end

    it "never mints a URL for another user's material (foreign reads are uniform NOT_FOUND)" do
      graphql(upload_mutation, token: token) # the owner attaches first
      create(:user, email: "storage-outsider@example.com", password: password)
      foreign_token = token_for("storage-outsider@example.com")

      result = graphql(
        'query { material(id: "' + material.id + '") { id downloadUrl } }', token: foreign_token
      )

      aggregate_failures do
        expect(error_code(result)).to eq("NOT_FOUND")
        expect(result.dig("data", "material")).to be_nil
      end
    end
  end

  describe "the direct-uploads route re-assertion (ticket 02 re-asserts per its text)" do
    it "still draws no ActiveStorage route while the presign flow is live" do
      mounted = Rails.application.routes.routes.select do |route|
        route.defaults[:controller].to_s.start_with?("active_storage/")
      end

      expect(mounted).to be_empty
      expect(Rails.application.routes.url_helpers).not_to respond_to(:rails_direct_uploads_url)
    end
  end
end
