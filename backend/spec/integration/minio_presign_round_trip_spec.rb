# frozen_string_literal: true

require "rails_helper"
require "net/http"
require "securerandom"
# The S3 adapter loads lazily (the engine requires it when the Configurator
# resolves an "S3" service) — require it explicitly here.
require "active_storage/service/s3_service"

# A1 spike (epic P2-6 ticket 01): prove v4 presigning round-trips against the
# dev minio BEFORE anything builds on it (ticket 02's createMaterialUpload
# flow). The client is ActiveStorage's own S3Service instantiated from
# config/storage.yml's :minio shape — the exact configuration the presign flow
# will get — and the PUT/GET are REAL HTTP requests (no WebMock anywhere in
# this suite) from the api container to http://minio:9000.
#
# REQUIRES the minio service: the DB-backed gate form (`docker compose run`
# without --no-deps) starts it (healthy, bucket initialized) before the api
# container; `run --no-deps` runs (rubocop) never execute specs. CI mirrors
# the shape with a minio service container (same dev creds; the bucket-ensure
# below covers CI's missing init step). Filterable: --tag minio.
RSpec.describe "minio presign round-trip (A1 spike)", minio: true do
  let(:minio_config) do
    # Parsed exactly the way the engine parses it (ERB → YAML).
    ActiveSupport::ConfigurationFile.parse(Rails.root.join("config/storage.yml"))
                                   .fetch("minio")
  end

  let(:service) do
    ActiveStorage::Service::S3Service.new(**minio_config.symbolize_keys.except(:service))
  end

  let(:client) { service.client.client } # Aws::S3::Resource wraps the Client
  let(:presigner) { Aws::S3::Presigner.new(client: client) }
  let(:bucket) { minio_config.fetch("bucket") }

  # Tolerant of first-boot latency: compose guarantees minio is healthy and
  # the bucket exists before the api container starts, but a fresh CI service
  # container has no init step — create the bucket idempotently if it is not
  # there yet, retrying through connection races.
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

  it "resolves the app's ActiveStorage service against minio from storage.yml" do
    expect(Rails.application.config.active_storage.service).to eq(:minio)
    expect(ActiveStorage::Blob.service).to be_a(ActiveStorage::Service::S3Service)
    expect(ActiveStorage::Blob.service.bucket.name).to eq("synapse-materials")
  end

  it "mints v4 presigned URLs" do
    url = presigner.presigned_url(:put_object, bucket: bucket, key: spike_key, expires_in: 900)

    expect(URI(url).query).to include("X-Amz-Algorithm=AWS4-HMAC-SHA256")
  end

  it "PUTs bytes through a presigned URL and GETs them back byte-identical" do
    body = "synapse presign spike #{SecureRandom.uuid}\n"

    put_uri = URI(presigner.presigned_url(:put_object, bucket: bucket, key: spike_key, expires_in: 900))
    put = Net::HTTP::Put.new(put_uri)
    put.body = body
    put_response = Net::HTTP.start(put_uri.host, put_uri.port) { |http| http.request(put) }

    expect(put_response.code).to eq("200")

    get_uri = URI(presigner.presigned_url(:get_object, bucket: bucket, key: spike_key, expires_in: 300))
    get_response = Net::HTTP.start(get_uri.host, get_uri.port) { |http| http.request(Net::HTTP::Get.new(get_uri)) }

    expect(get_response.code).to eq("200")
    expect(get_response.body).to eq(body)
  end

  private

  def spike_key
    @spike_key ||= "spike/#{SecureRandom.uuid}.txt"
  end

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
