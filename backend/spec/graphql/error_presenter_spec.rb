# frozen_string_literal: true

require "rails_helper"

RSpec.describe ErrorPresenter do
  # Maps an unwrapped command failure (result.failure) into the GraphQL
  # error payload shape: resolvers/mutations feed it to
  # GraphQL::ExecutionError.new(payload[:message], extensions: payload[:extensions]).
  it "maps a command failure into a payload with the code in extensions.code" do
    failure = ApplicationErrors::Failure.new(
      code: :NOT_FOUND,
      context: { message: "study plan not found", plan_id: "p1" }
    )

    payload = described_class.call(failure)

    expect(payload).to eq(
      message: "study plan not found",
      extensions: { code: "NOT_FOUND" }
    )
  end

  it "falls back to the code string as the message when the context has none" do
    failure = ApplicationErrors::Failure.new(code: :RATE_LIMITED)

    payload = described_class.call(failure)

    expect(payload[:message]).to eq("RATE_LIMITED")
    expect(payload[:extensions][:code]).to eq("RATE_LIMITED")
  end

  # Contract pin: every closed-enum code travels as its string form in
  # extensions.code — that is the field the web's AppError.code mirrors 1:1.
  it "stringifies every closed-enum code into extensions.code" do
    ApplicationErrors::CODES.each do |code|
      payload = described_class.call(ApplicationErrors::Failure.new(code: code))

      expect(payload[:extensions][:code]).to eq(code.to_s)
    end
  end

  # Boundary guard: input that bypassed the shape contract (anything but
  # `result.failure`, e.g. a raw exception) must not crash the GraphQL layer
  # with NoMethodError — it degrades to the INTERNAL payload.
  it "maps a bypassed raw failure (not an ApplicationErrors::Failure) to the INTERNAL payload" do
    payload = described_class.call(StandardError.new("boom"))

    expect(payload).to eq(message: "internal error", extensions: { code: "INTERNAL" })
  end

  it "keeps the INTERNAL degradation for other wrong shapes (nil, bare symbol) too" do
    aggregate_failures do
      expect(described_class.call(nil)).to eq(message: "internal error", extensions: { code: "INTERNAL" })
      expect(described_class.call(:NOT_FOUND)).to eq(message: "internal error", extensions: { code: "INTERNAL" })
    end
  end
end
