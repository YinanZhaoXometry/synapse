# frozen_string_literal: true

require "rails_helper"

# Ai::Provider seam (tickets 01+02): ENV-at-call-time config, the INTERNAL
# mapping for transport faults, CAP_REACHED at the adapter boundary, and the
# stub-ability contract (specs override .adapter, never the transport).
RSpec.describe Ai::Provider do
  around do |example|
    keys = %w[AI_API_KEY AI_BASE_URL AI_MODEL AI_TIMEOUT_SECONDS AI_DAILY_CALL_CAP]
    originals = keys.to_h { |key| [ key, ENV[key] ] }
    keys.each { |key| ENV.delete(key) }
    example.run
  ensure
    originals.each do |key, value|
      value.nil? ? ENV.delete(key) : ENV[key] = value
    end
  end

  let(:user) { create(:user) }
  let(:adapter) { double("client") }

  before do
    ENV["AI_API_KEY"] = "k"
    allow(described_class).to receive(:adapter).and_return(adapter)
  end

  describe ".configuration" do
    it "falls back to the built-in defaults when ENV is unset" do
      allow(described_class).to receive(:adapter).and_call_original
      ENV.delete("AI_API_KEY")

      expect(described_class.configuration).to eq(
        base_url: "https://open.bigmodel.cn/api/paas/v4",
        api_key: "",
        model: "glm-4-flash",
        timeout_seconds: 120
      )
    end

    it "overrides from ENV and falls back on garbage values" do
      allow(described_class).to receive(:adapter).and_call_original
      ENV["AI_API_KEY"] = " k "
      ENV["AI_BASE_URL"] = "http://127.0.0.1:9/v1 "
      ENV["AI_MODEL"] = "model-x"
      ENV["AI_TIMEOUT_SECONDS"] = "garbage"

      config = described_class.configuration
      expect(config[:api_key]).to eq("k")
      expect(config[:base_url]).to eq("http://127.0.0.1:9/v1")
      expect(config[:model]).to eq("model-x")
      expect(config[:timeout_seconds]).to eq(120) # garbage → default
    end
  end

  describe ".configured?" do
    it "tracks AI_API_KEY presence" do
      ENV.delete("AI_API_KEY")
      expect(described_class).not_to be_configured
      ENV["AI_API_KEY"] = "real-key"
      expect(described_class).to be_configured
    end
  end

  describe ".complete" do
    it "fails INTERNAL before touching anything when unconfigured — and does not consume the cap" do
      ENV.delete("AI_API_KEY")

      result = described_class.complete(user: user, messages: [ { role: "user", content: "hi" } ])
      expect(result.failure.code).to eq(:INTERNAL)
      expect(result.failure.context[:message]).to match(/not configured/)
      expect(user.ai_usage_counters).to be_empty
    end

    it "returns the raw completion through the adapter and consumes one call" do
      allow(adapter).to receive(:complete).and_return("raw text")

      result = described_class.complete(user: user, messages: [ { role: "user", content: "hi" } ])
      expect(result.value!).to eq("raw text")
      expect(user.ai_usage_counters.sole.call_count).to eq(1)
    end

    it "maps a transport ProviderError to Failure(:INTERNAL) with an English log line" do
      allow(adapter).to receive(:complete).and_raise(Ai::ProviderError, "provider returned HTTP 429")

      result = described_class.complete(user: user, messages: [ { role: "user", content: "hi" } ])
      expect(result.failure.code).to eq(:INTERNAL)
      expect(result.failure.context[:message]).to include("provider returned HTTP 429")
    end

    it "admits the 50th call and refuses the 51st with CAP_REACHED, without calling the adapter" do
      create(:ai_usage_counter, user: user, call_count: 49)
      allow(adapter).to receive(:complete).and_return("ok")

      admitted = described_class.complete(user: user, messages: [])
      expect(admitted).to be_success
      expect(user.ai_usage_counters.sole.call_count).to eq(50)

      refused = described_class.complete(user: user, messages: [])
      expect(refused.failure.code).to eq(:CAP_REACHED)
      expect(refused.failure.context[:message]).to include("51/50")
      expect(adapter).to have_received(:complete).once # the refusal never touches the transport
    end

    it "honors AI_DAILY_CALL_CAP for the boundary" do
      ENV["AI_DAILY_CALL_CAP"] = "2"
      allow(adapter).to receive(:complete).and_return("ok")

      described_class.complete(user: user, messages: [])
      described_class.complete(user: user, messages: [])
      refused = described_class.complete(user: user, messages: [])
      expect(refused.failure.code).to eq(:CAP_REACHED)
    end
  end

  describe ".stream" do
    it "hands back the lazy enumerator; transport faults surface at pull time" do
      deltas = %w[a b]
      allow(adapter).to receive(:stream).and_return(deltas.each)

      result = described_class.stream(user: user, messages: [ { role: "user", content: "hi" } ])
      expect(result.value!.to_a).to eq(%w[a b])
    end

    it "counts every stream invocation — a restart after a drop is a counted call (AD-16)" do
      allow(adapter).to receive(:stream).and_return([].each)

      described_class.stream(user: user, messages: [])
      described_class.stream(user: user, messages: [])
      expect(user.ai_usage_counters.sole.call_count).to eq(2)
    end

    it "fails INTERNAL when unconfigured, like .complete" do
      ENV.delete("AI_API_KEY")

      result = described_class.stream(user: user, messages: [ { role: "user", content: "hi" } ])
      expect(result.failure.code).to eq(:INTERNAL)
    end

    it "refuses with CAP_REACHED before returning an enumerator once the cap is gone" do
      create(:ai_usage_counter, user: user, call_count: 50)
      allow(adapter).to receive(:stream)

      result = described_class.stream(user: user, messages: [])
      expect(result.failure.code).to eq(:CAP_REACHED)
      expect(adapter).not_to have_received(:stream) # refusal never touches the transport
    end
  end
end
