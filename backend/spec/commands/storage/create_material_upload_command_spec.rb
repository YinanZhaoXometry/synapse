# frozen_string_literal: true

require "rails_helper"

RSpec.describe Storage::CreateMaterialUploadCommand do
  # Direct command testing (AD-10) — the GraphQL mutation is a thin boundary
  # over this seam; the HTTP-level behavior is pinned in the request specs
  # (spec/requests/graphql_storage_upload_spec.rb) and the real bytes
  # round-trip against minio in spec/integration/storage_round_trip_spec.rb.
  #
  # No bytes flow here and no network runs: minting the Blob is a Postgres
  # row (the direct-upload builder's contract) and presigning is pure
  # client-side v4 signing — every assertion below reads the minted rows and
  # the URL's signed query parameters.

  let(:user) { create(:user) }
  let(:material) { create(:material, user: user) }

  def call(overrides = {})
    described_class.call(
      current_user: user,
      filename: "lecture.pdf",
      content_type: "application/pdf",
      size: 1_234,
      material_id: material.id,
      **overrides
    )
  end

  describe ".call" do
    it "mints a Blob, attaches it to the material, and returns the presigned PUT + linkage" do
      result = call

      expect(result.success?).to be(true)
      payload = result.value!

      aggregate_failures do
        expect(payload[:blob_key]).to be_present
        expect(payload[:material_id]).to eq(material.id)
        expect(payload[:expires_at]).to be_within(5.seconds).of(Storage::UPLOAD_PRESIGN_TTL_SECONDS.seconds.from_now)
        expect(payload[:upload_url]).to include("X-Amz-Algorithm=AWS4-HMAC-SHA256")
      end

      blob = material.reload.original.blob
      expect(blob).to be_present
      expect(payload[:blob_key]).to eq(blob.key)
    end

    it "mints the key per the pinned convention: materials/{user_id}/{uuid}{ext} (ext from the VALIDATED content type)" do
      result = call

      key = result.value![:blob_key]
      ext = Storage::UPLOADABLE_CONTENT_TYPES.fetch("application/pdf")
      pattern = %r{\Amaterials/#{user.id}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}#{Regexp.escape(ext)}\z}
      expect(key).to match(pattern)
    end

    it "keeps the client filename and payload facts on the blob (the direct-upload row shape)" do
      call

      blob = material.reload.original.blob
      aggregate_failures do
        expect(blob.filename.to_s).to eq("lecture.pdf")
        expect(blob.content_type).to eq("application/pdf")
        expect(blob.byte_size).to eq(1_234)
        expect(blob.service_name).to eq("minio")
        expect(material.original.attached?).to be(true)
        # The review-round pin on the no-jobs mechanism: analysis is marked
        # terminal up front (a persisted column), so attaching never enqueues
        # the download-hungry AnalyzeJob. (`identified` is in-memory parity —
        # it does not survive the reload.)
        expect(blob.analyzed).to be(true)
      end
    end

    it "maps the content type to the key extension (markdown → .md, text/plain → .txt)" do
      md = call(filename: "notes.md", content_type: "text/markdown")
      txt = call(filename: "notes.txt", content_type: "text/plain")

      expect(md.value![:blob_key]).to end_with(".md")
      expect(txt.value![:blob_key]).to end_with(".txt")
    end

    it "derives the key extension from the content type, never from the client filename" do
      result = call(filename: "evil.executable", content_type: "application/pdf")

      expect(result.value![:blob_key]).to end_with(".pdf")
    end

    it "replaces the material's attachment on re-upload (has_one_attached)" do
      first = call
      second = call

      expect(second.value![:blob_key]).not_to eq(first.value![:blob_key])
      expect(material.reload.original.blob.key).to eq(second.value![:blob_key])
      expect(ActiveStorage::Attachment.where(record: material).count).to eq(1)
    end

    it "mints a distinct key per call" do
      keys = Array.new(3) { call.value![:blob_key] }

      expect(keys.uniq.size).to eq(3)
    end

    it "runs the TTL constant into the URL (X-Amz-Expires=900) and honors the injection seam" do
      default = call
      injected = call(upload_ttl_seconds: 60)

      expect(URI(default.value![:upload_url]).query).to include("X-Amz-Expires=900")
      expect(URI(injected.value![:upload_url]).query).to include("X-Amz-Expires=60")
    end

    it "fails VALIDATION_FAILED for a blank filename" do
      result = call(filename: "   ")

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(result.failure.context[:field]).to eq(:filename)
      expect(user.materials.find(material.id).original.attached?).to be(false)
    end

    it "fails VALIDATION_FAILED for a filename beyond the blob row's 255-character column (never INTERNAL)" do
      result = call(filename: "x" * 256)

      aggregate_failures do
        expect(result.failure?).to be(true)
        expect(result.failure.code).to eq(:VALIDATION_FAILED)
        expect(result.failure.context[:field]).to eq(:filename)
      end
      expect(ActiveStorage::Blob.where(filename: "x" * 256).count).to eq(0)
    end

    it "fails VALIDATION_FAILED for a content type outside the allowlist" do
      result = call(content_type: "application/zip")

      aggregate_failures do
        expect(result.failure?).to be(true)
        expect(result.failure.code).to eq(:VALIDATION_FAILED)
        expect(result.failure.context[:field]).to eq(:contentType)
      end
      expect(user.materials.find(material.id).original.attached?).to be(false)
    end

    it "fails VALIDATION_FAILED for a non-positive size and one beyond the 100 MiB cap" do
      aggregate_failures do
        expect(call(size: 0).failure.code).to eq(:VALIDATION_FAILED)
        expect(call(size: -5).failure.code).to eq(:VALIDATION_FAILED)
        expect(call(size: Storage::MAX_UPLOAD_BYTES + 1).failure.code).to eq(:VALIDATION_FAILED)
      end
      expect(user.materials.find(material.id).original.attached?).to be(false)
    end

    it "accepts a size at exactly the cap" do
      result = call(size: Storage::MAX_UPLOAD_BYTES)

      expect(result.success?).to be(true)
    end

    it "answers NOT_FOUND for an unknown material uuid" do
      result = call(material_id: SecureRandom.uuid)

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:NOT_FOUND)
      expect(ActiveStorage::Blob.where(filename: "lecture.pdf").count).to eq(0)
    end

    it "answers NOT_FOUND for another user's material (uniform convention, delta 2 — never reveals existence)" do
      foreign = create(:material, user: create(:user))

      result = call(material_id: foreign.id)

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:NOT_FOUND)
      expect(foreign.reload.original.attached?).to be(false)
    end

    it "answers NOT_FOUND for a malformed material id" do
      result = call(material_id: "garbage")

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:NOT_FOUND)
    end
  end
end
