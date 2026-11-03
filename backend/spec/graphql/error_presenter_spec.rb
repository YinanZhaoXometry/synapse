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
end
