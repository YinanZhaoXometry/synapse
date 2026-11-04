# frozen_string_literal: true

require "rails_helper"
require "net/http"
require "securerandom"
# The S3 adapter loads lazily (the engine requires it when the Configurator
# resolves an "S3" service) — require it explicitly here.
require "active_storage/service/s3_service"

# The ticket-02 acceptance flow (AD-13, epic P2-6): presign → real PUT → the
# downloadUrl field serves the bytes back — the full direct-upload round trip
# through GraphQL against the dev minio, plus the TTL-expiry proof (expired
# URLs are refused, both directions). Wire calls go through POST /graphql as
# a logged-in user; the byte PUTs/GETs are REAL HTTP requests (no WebMock
# anywhere in this suite) from the api container to http://minio:9000.
#
# REQUIRES the minio service exactly like the ticket-01 spike
# (spec/integration/minio_presign_round_trip_spec.rb): the DB-backed gate
# form (`docker compose run` without --no-deps) starts it (healthy, bucket
# initialized) before the api container. Filterable: --tag minio.
RSpec.describe "storage round trip (epic P2-6 ticket 02)", minio: true, type: :request do
  # The password must be the harness's known one — token_for logs in over
  # HTTP against it (GraphqlSpecHelpers).
  let(:user) { create(:user, email: "storage-roundtrip@example.com", password: password) }
  let(:token) { token_for(user.email) }
  let(:material) { create(:material, user: user) }

  # The warmup/bucket-ensure block is lifted verbatim from the spike spec —
  # CI's minio service container has no init step, and first-boot latency
  # needs tolerance.
  let(:minio_config) do
    ActiveSupport::ConfigurationFile.parse(Rails.root.join("config/storage.yml"))
                                   .fetch("minio")
  end

  let(:service) do
    ActiveStorage::Service::S3Service.new(**minio_config.symbolize_keys.except(:service))
  end

  let(:client) { service.client.client }
  let(:bucket) { minio_config.fetch("bucket") }

  before do
    with_minio_warmup do
      begin
        client.head_bucket(bucket: bucket)
      rescue Aws::S3::Errors::NotFound
        begin
          client.create_bucket(bucket: bucket)
        rescue Aws::S3::Errors::BucketAlreadyOwnedByYou, Aws::S3::Errors::BucketAlreadyExists
          # another warmup raced us to it
        end
      end
    end
  end

  it "presigns through GraphQL, PUTs real bytes, and serves them back through downloadUrl" do
    body = "synapse storage round trip #{SecureRandom.uuid}\n"

    presigned = graphql(<<~GRAPHQL, token: token)
      mutation {
        createMaterialUpload(input: {
          materialId: "#{material.id}",
          filename: "lecture.pdf",
          contentType: "application/pdf",
          size: #{body.bytesize}
        }) { uploadUrl materialId expiresAt }
      }
    GRAPHQL

    expect(presigned["errors"]).to be_nil
    upload_url = presigned.dig("data", "createMaterialUpload", "uploadUrl")

    put_uri = URI(upload_url)
    put = Net::HTTP::Put.new(put_uri)
    put.body = body
    # The browser PUTs with the file's content type; minio stores it and the
    # presigned GET echoes it back. (The URL's signature does not cover it —
    # only the signed headers do, host by default.)
    put["Content-Type"] = "application/pdf"
    put_response = Net::HTTP.start(put_uri.host, put_uri.port) { |http| http.request(put) }
    expect(put_response.code).to eq("200")

    # The ordering claim the downloadUrl field documents: between the presign
    # and the PUT the URL is mintable but the bytes are not there — the
    # provider refuses (this read happens after our PUT above; the fresh
    # presign below mints the GET for the bytes now present).
    download = graphql(
      'query { material(id: "' + material.id + '") { downloadUrl } }', token: token
    )
    get_uri = URI(download.dig("data", "material", "downloadUrl"))
    get_response = Net::HTTP.start(get_uri.host, get_uri.port) { |http| http.request(Net::HTTP::Get.new(get_uri)) }

    aggregate_failures do
      expect(get_response.code).to eq("200")
      expect(get_response.body).to eq(body)
      expect(get_response["content-type"]).to start_with("application/pdf")
    end
  end

  it "refuses an expired presigned PUT (the command's TTL seam at 1s, then real time passes it)" do
    result = Storage::CreateMaterialUploadCommand.call(
      current_user: user,
      filename: "late.pdf",
      content_type: "application/pdf",
      size: 12,
      material_id: material.id,
      upload_ttl_seconds: 1
    )

    expect(result.success?).to be(true)
    sleep 2 # the 1-second TTL lapses — real time, no clock stubbing

    put_uri = URI(result.value![:upload_url])
    put = Net::HTTP::Put.new(put_uri)
    put.body = "too late\n"
    put_response = Net::HTTP.start(put_uri.host, put_uri.port) { |http| http.request(put) }

    aggregate_failures do
      expect(put_response.code).to eq("403")
      expect(put_response.body).to include("Request has expired")
    end
  end

  it "refuses an expired presigned GET (the same seam behind the downloadUrl field)" do
    body = "expiring get #{SecureRandom.uuid}\n"
    graphql(
      "mutation { createMaterialUpload(input: { materialId: \"#{material.id}\", " \
        "filename: \"expiring.txt\", contentType: \"text/plain\", size: #{body.bytesize} }) { uploadUrl } }",
      token: token
    )
    key = material.reload.original.blob.key
    put_uri = URI(Storage.presigned_put_url(key))
    put = Net::HTTP::Put.new(put_uri)
    put.body = body
    put_response = Net::HTTP.start(put_uri.host, put_uri.port) { |http| http.request(put) }
    expect(put_response.code).to eq("200")

    expired_get = Storage.presigned_get_url(key, expires_in: 1)
    sleep 2 # lapse the 1-second TTL

    get_uri = URI(expired_get)
    get_response = Net::HTTP.start(get_uri.host, get_uri.port) { |http| http.request(Net::HTTP::Get.new(get_uri)) }

    aggregate_failures do
      expect(get_response.code).to eq("403")
      expect(get_response.body).to include("Request has expired")
    end
  end

  private

  def with_minio_warmup(max_attempts = 5)
    attempt = 0
    begin
      yield
    rescue Seahorse::Client::NetworkingError, Errno::ECONNREFUSED, Net::OpenTimeout
      attempt += 1
      raise if attempt >= max_attempts

      sleep 2
      retry
    end
  end
end
