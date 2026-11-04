# frozen_string_literal: true

require "rails_helper"

# AD-13 (epic P2-6 ticket 01): one storage.yml shape per environment, selected
# by the environment file — `minio` (dev/test, the R2 stand-in served by the
# compose service) and `r2` (production, every value from ENV with no
# defaults). The guard is the spec: these assertions pin the selection
# contract and both service shapes so drift in either fails loudly.
RSpec.describe "ActiveStorage service configuration" do
  describe "per-environment service selection" do
    it "selects :minio in the test environment (live config)" do
      expect(Rails.application.config.active_storage.service).to eq(:minio)
    end

    # development/production are not booted in this suite; their selection
    # lines are pinned textually (the files are the env-fork contract).
    it "selects :minio in the development environment" do
      expect(File.read(Rails.root.join("config/environments/development.rb")))
        .to match(/config\.active_storage\.service\s*=\s*:minio/)
    end

    it "selects :r2 in production" do
      expect(File.read(Rails.root.join("config/environments/production.rb")))
        .to match(/config\.active_storage\.service\s*=\s*:r2/)
    end

    it "fails production boot fast when an R2_* var is missing" do
      source = File.read(Rails.root.join("config/environments/production.rb"))
      %w[R2_ENDPOINT R2_BUCKET R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY].each do |var|
        expect(source).to include(var)
      end
    end
  end

  describe "config/storage.yml" do
    # Parsed exactly the way the engine parses it
    # (ActiveSupport::ConfigurationFile.parse → ERB → YAML), so the ERB is
    # under test, not just the text.
    let(:configs) do
      ActiveSupport::ConfigurationFile.parse(Rails.root.join("config/storage.yml"))
    end

    it "defines the minio R2-stand-in service" do
      minio = configs.fetch("minio")

      expect(minio.fetch("service")).to eq("S3")
      expect(minio.fetch("endpoint")).to eq("http://minio:9000")
      expect(minio.fetch("bucket")).to eq("synapse-materials")
      expect(minio.fetch("force_path_style")).to eq(true)
      # dev defaults live in the file (compose's MINIO_ROOT_* must stay
      # aligned); ENV overrides them when R2_* is exported.
      expect(minio.fetch("access_key_id")).to be_present
      expect(minio.fetch("secret_access_key")).to be_present
    end

    it "sources every r2 value from ENV with no defaults" do
      r2 = configs.fetch("r2")

      expect(r2.fetch("service")).to eq("S3")
      expect(r2.fetch("region")).to eq("auto")
      # Plain ENV[...] — nil when unset, so nothing can silently default in
      # production; production.rb fails fast on the missing vars instead.
      source = File.read(Rails.root.join("config/storage.yml"))
      %w[R2_ENDPOINT R2_BUCKET R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY].each do |var|
        expect(source).to include(%(ENV["#{var}"]))
      end
    end
  end
end
