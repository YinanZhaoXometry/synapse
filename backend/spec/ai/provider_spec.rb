# frozen_string_literal: true

require "rails_helper"

# Ai::Provider seam (ticket 01): ENV-at-call-time config, the INTERNAL
# mapping for transport faults, and the stub-ability contract (specs
# override .adapter, never the transport).
RSpec.describe Ai::Provider do
  around do |example|
    keys = %w[PROVIDER_KEY PROVIDER_BASE_URL PROVIDER_MODEL PROVIDER_TIMEOUT_SECONDS]
    originals = keys.to_h { |key| [ key, ENV[key] ] }
    keys.each { |key| ENV.delete(key) }
    example.run
  ensure
    originals.each do |key, value|
      value.nil? ? ENV.delete(key) : ENV[key] = value
    end
  end

  describe ".configuration" do
    it "falls back to the GLM-first defaults when ENV is unset" do
      expect(described_class.configuration).to eq(
        base_url: "https://open.bigmodel.cn/api/paas/v4",
        api_key: "",
        model: "glm-4-flash",
        timeout_seconds: 120
      )
    end

    it "overrides from ENV and falls back on garbage values" do
      ENV["PROVIDER_KEY"] = " k "
      ENV["PROVIDER_BASE_URL"] = "http://127.0.0.1:9/v1 "
      ENV["PROVIDER_MODEL"] = "glm-x"
      ENV["PROVIDER_TIMEOUT_SECONDS"] = "garbage"

      config = described_class.configuration
      expect(config[:api_key]).to eq("k")
      expect(config[:base_url]).to eq("http://127.0.0.1:9/v1")
      expect(config[:model]).to eq("glm-x")
      expect(config[:timeout_seconds]).to eq(120) # garbage → default
    end
  end

  describe ".configured?" do
    it "tracks PROVIDER_KEY presence" do
      expect(described_class).not_to be_configured
      ENV["PROVIDER_KEY"] = "real-key"
      expect(described_class).to be_configured
    end
  end

  describe ".complete" do
    it "fails INTERNAL before touching anything when unconfigured" do
      result = described_class.complete([ { role: "user", content: "hi" } ])
      expect(result.failure.code).to eq(:INTERNAL)
      expect(result.failure.context[:message]).to match(/not configured/)
    end

    it "returns the raw completion through the adapter" do
      ENV["PROVIDER_KEY"] = "k"
      adapter = double("client", complete: "raw text")
      allow(described_class).to receive(:adapter).and_return(adapter)

      result = described_class.complete([ { role: "user", content: "hi" } ])
      expect(result.value!).to eq("raw text")
    end

    it "maps a transport ProviderError to Failure(:INTERNAL) with an English log line" do
      ENV["PROVIDER_KEY"] = "k"
      adapter = double("client")
      allow(described_class).to receive(:adapter).and_return(adapter)
      allow(adapter).to receive(:complete).and_raise(Ai::ProviderError, "provider returned HTTP 429")

      result = described_class.complete([ { role: "user", content: "hi" } ])
      expect(result.failure.code).to eq(:INTERNAL)
      expect(result.failure.context[:message]).to include("provider returned HTTP 429")
    end
  end

  describe ".stream" do
    it "hands back the lazy enumerator; transport faults surface at pull time" do
      ENV["PROVIDER_KEY"] = "k"
      deltas = %w[a b]
      adapter = double("client")
      allow(described_class).to receive(:adapter).and_return(adapter)
      allow(adapter).to receive(:stream).and_return(deltas.each)

      result = described_class.stream([ { role: "user", content: "hi" } ])
      expect(result.value!.to_a).to eq(%w[a b])
    end

    it "fails INTERNAL when unconfigured, like .complete" do
      result = described_class.stream([ { role: "user", content: "hi" } ])
      expect(result.failure.code).to eq(:INTERNAL)
    end
  end
end
