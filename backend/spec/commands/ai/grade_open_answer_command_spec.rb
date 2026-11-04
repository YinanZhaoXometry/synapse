# frozen_string_literal: true

require "rails_helper"

# Ai::GradeOpenAnswerCommand (ticket 03): grade against the question's own
# cited section — a pure computation (no persistence; the client turns the
# outcome into evidence via recordEvidence).
RSpec.describe Ai::GradeOpenAnswerCommand do
  around do |example|
    keys = %w[PROVIDER_KEY AI_DAILY_CALL_CAP]
    originals = keys.to_h { |key| [ key, ENV[key] ] }
    keys.each { |key| ENV.delete(key) }
    ENV["PROVIDER_KEY"] = "test-key"
    example.run
  ensure
    originals.each do |key, value|
      value.nil? ? ENV.delete(key) : ENV[key] = value
    end
  end

  let(:user) { create(:user) }
  let(:adapter) { double("client") }

  before do
    allow(Ai::Provider).to receive(:adapter).and_return(adapter)
  end

  def call(question:, answer: "the user_id column scopes every row", language: "en")
    described_class.call(current_user: user, question_id: question.id, answer: answer, language: language)
  end

  def grade_payload(outcome: "correct", rationale: "both key terms used", quote: "Every row is scoped by user_id.")
    { outcome: outcome, rationale: rationale, quote: quote }.to_json
  end

  it "grades a markdown-sourced question with a section locator + quote" do
    question = create(:question, user: user, source_section_id: "sec-1", keywords: [ "user_id", "scope" ],
                              source_material: create(:material, user: user, sections: [
                                { "id" => "sec-1", "title" => "S", "text" => "Every row is scoped by user_id." }
                              ]))
    allow(adapter).to receive(:complete).and_return(grade_payload)

    result = call(question: question)
    expect(result).to be_success
    graded = result.value!
    expect(graded.outcome).to eq("correct")
    expect(graded.rationale).to eq("both key terms used")
    expect(graded.citation.locator).to eq({ "kind" => "markdown", "sectionId" => "sec-1" })
    expect(graded.citation.quote).to eq("Every row is scoped by user_id.")
    # A pure computation — no evidence ever written here.
    expect { call(question: question) }.not_to change(EvidenceRecord, :count)
  end

  it "builds a page locator for pdf materials" do
    pdf = create(:material, user: user, kind: "pdf", sections: [
      { "id" => "page-1", "title" => "P1", "text" => "first" },
      { "id" => "page-2", "title" => "P2", "text" => "second" }
    ])
    question = create(:question, user: user, source_material: pdf, source_section_id: "page-2", keywords: [ "k" ])
    allow(adapter).to receive(:complete).and_return(grade_payload(quote: nil))

    result = call(question: question)
    expect(result.value!.citation.locator).to eq({ "kind" => "pdf", "page" => 2 })
    expect(result.value!.citation.quote).to be_nil
  end

  it "fails NOT_FOUND when the question or its source section is gone" do
    allow(adapter).to receive(:complete)
    question = create(:question, user: user, source_section_id: "ghost")
    expect(call(question: question).failure.code).to eq(:NOT_FOUND)

    malformed = described_class.call(current_user: user, question_id: "not-a-uuid", answer: "a", language: "en")
    expect(malformed.failure.code).to eq(:NOT_FOUND)
    expect(adapter).not_to have_received(:complete)
  end

  it "fails INTERNAL on an outcome outside the vocabulary or an empty rationale" do
    question = create(:question, user: user, source_section_id: "sec-1",
                              source_material: create(:material, user: user, sections: [ { "id" => "sec-1", "title" => "S", "text" => "t" } ]))

    allow(adapter).to receive(:complete).and_return(grade_payload(outcome: "excellent"))
    expect(call(question: question).failure.code).to eq(:INTERNAL)

    allow(adapter).to receive(:complete).and_return(grade_payload(rationale: " "))
    expect(call(question: question).failure.code).to eq(:INTERNAL)
  end

  it "validates the language argument" do
    question = create(:question, user: user)
    expect(call(question: question, language: "fr").failure.code).to eq(:VALIDATION_FAILED)
  end
end
