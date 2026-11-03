# frozen_string_literal: true

require "rails_helper"

RSpec.describe System::PingCommand do
  # The AD-12 pattern exemplar, called directly (AD-10) — no GraphQL involved.
  describe ".call" do
    it "returns Success with the default pong payload" do
      result = described_class.call

      expect(result.success?).to be(true)
      expect(result.value!).to eq(pong: "pong")
    end

    it "echoes a custom message" do
      result = described_class.call(message: "hello")

      expect(result.value!).to eq(pong: "hello")
    end

    it "fails with a typed VALIDATION_FAILED on a blank message" do
      result = described_class.call(message: "   ")

      expect(result.failure?).to be(true)
      failure = result.failure
      expect(failure.code).to eq(:VALIDATION_FAILED)
      expect(failure.context[:message]).to be_a(String)
    end
  end
end
