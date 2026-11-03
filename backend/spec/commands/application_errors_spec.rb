# frozen_string_literal: true

require "rails_helper"

RSpec.describe ApplicationErrors do
  # The closed error enum (AD-12), verbatim and in contract order — the web's
  # AppError.code (frontend/src/data/errors.ts) mirrors it 1:1 via
  # extensions.code. Adding a code touches both sides in the same change.
  it "defines exactly the seven closed-enum codes, in contract order" do
    expect(ApplicationErrors::CODES).to eq(
      %i[UNAUTHORIZED FORBIDDEN NOT_FOUND VALIDATION_FAILED RATE_LIMITED CAP_REACHED INTERNAL]
    )
  end

  it "freezes the enum" do
    expect(ApplicationErrors::CODES).to be_frozen
  end

  describe "Failure" do
    it "carries a code and normalizes a missing context to an empty hash" do
      failure = ApplicationErrors::Failure.new(code: :NOT_FOUND)

      expect(failure.code).to eq(:NOT_FOUND)
      expect(failure.context).to eq({})
    end

    it "keeps the given context" do
      failure = ApplicationErrors::Failure.new(code: :NOT_FOUND, context: { plan_id: "p1" })

      expect(failure.context).to eq(plan_id: "p1")
    end
  end

  describe "InvalidCodeError" do
    it "is an ArgumentError — the fail-fast guard raise is a misuse signal" do
      expect(ApplicationErrors::InvalidCodeError < ArgumentError).to be(true)
    end
  end
end
