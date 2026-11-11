# frozen_string_literal: true

require "rails_helper"

# Ai::ProposeLessonOutlineCommand (epic-36 T1, spec decision 5 — ① 材料讲义's
# outline gate): a parsed, section-bearing material becomes a chapter
# outline — STATELESS (nothing persists; a re-roll is one more call), one
# cap-counted provider call, the reply normalized server-side (bad chapters
# drop, the template cap holds, zero survivors → INTERNAL). The gate refuses
# before anything is spent: unparsed/section-less materials, generated
# lessons as sources (the 源池排他 law's gate-side half), foreign/malformed
# ids.
RSpec.describe Ai::ProposeLessonOutlineCommand do
  around do |example|
    keys = %w[AI_API_KEY AI_DAILY_CALL_CAP]
    originals = keys.to_h { |key| [ key, ENV[key] ] }
    keys.each { |key| ENV.delete(key) }
    ENV["AI_API_KEY"] = "test-key"
    example.run
  ensure
    originals.each do |key, value|
      value.nil? ? ENV.delete(key) : ENV[key] = value
    end
  end

  let(:user) { create(:user) }
  let(:material) do
    create(:material, user: user, parse_state: "parsed", title: "Distributed notes", sections: [
      { "id" => "sec-1", "title" => "Raft", "text" => "leader election and log replication" },
      { "id" => "sec-2", "title" => "Chains", "text" => "chain replication passes writes down a chain" }
    ])
  end
  let(:adapter) { double("client") }
  let(:completions) { [] }

  before do
    allow(Ai::Provider).to receive(:adapter).and_return(adapter)
    allow(adapter).to receive(:complete) do |messages|
      completions << messages.map { |message| message[:content] }.join
      reply
    end
  end

  # The provider's reply — two well-formed chapters over the material's two
  # sections, plus one junk chapter (unknown id) the normalization drops.
  let(:reply) do
    {
      chapters: [
        { title: "Raft 选举", sourceSectionIds: [ "sec-1" ] },
        { title: "链式复制", sourceSectionIds: [ "sec-2", "sec-does-not-exist" ] },
        { title: "凭空一章", sourceSectionIds: [ "ghost" ] }
      ]
    }.to_json
  end

  def call(material_id: material.id, language: "zh")
    described_class.call(current_user: user, material_id: material_id, language: language)
  end

  it "returns the normalized outline (bad chapters drop, ids resolve server-side) and spends one cap-counted call" do
    result = call

    aggregate_failures do
      expect(result).to be_success
      outline = result.value![:outline]
      expect(outline.length).to eq(2)
      expect(outline.first).to eq("title" => "Raft 选举", "sourceSectionIds" => [ "sec-1" ])
      expect(outline.second["sourceSectionIds"]).to eq([ "sec-2" ])
      expect(completions.length).to eq(1)
    end
    expect(AiUsageCounter.find_by(user: user).call_count).to eq(1)
  end

  it "grounds the prompt on the material's own sections and pins the template cap" do
    call
    prompt = completions.sole
    aggregate_failures do
      expect(prompt).to include("leader election and log replication")
      expect(prompt).to include("Distributed notes")
      expect(prompt).to include("At most #{Ai::Lessons::MATERIAL_MAX_SECTIONS} chapters")
      expect(prompt).to include("in 简体中文.")
    end
  end

  it "carries the exact estimate for the confirmed outline size (the confirm page's number)" do
    result = call
    expect(result.value![:estimated_calls]).to eq(Ai::Lessons.estimate(variant: "material", section_count: 2).total_min)
  end

  it "is stateless — no material row is created (a re-roll is just another call)" do
    material # create the subject outside the counted block
    expect { call }.not_to change(Material, :count)
  end

  it "caps the outline at the template ceiling (a greedy reply never exceeds 8 chapters)" do
    greedy = { chapters: (1..10).map { |n| { title: "第#{n}章", sourceSectionIds: [ "sec-1" ] } } }.to_json
    allow(adapter).to receive(:complete).and_return(greedy)

    result = call
    expect(result.value![:outline].length).to eq(Ai::Lessons::MATERIAL_MAX_SECTIONS)
  end

  it "answers INTERNAL when the reply normalizes to zero usable chapters (a provider-contract violation)" do
    allow(adapter).to receive(:complete) do |messages|
      completions << messages.map { |message| message[:content] }.join
      { chapters: [ { title: "凭空", sourceSectionIds: [ "ghost" ] } ] }.to_json
    end

    result = call
    expect(result).to be_failure
    expect(result.failure.code).to eq(:INTERNAL)
    expect(completions.length).to eq(1) # the cap was spent — the failure is honest about it
  end

  it "answers INTERNAL on an unparseable reply" do
    allow(adapter).to receive(:complete).and_return("no json here at all")

    expect(call.failure.code).to eq(:INTERNAL)
  end

  it "refuses a material that is not parsed (the parsed∧sections gate)" do
    unparsed = create(:material, user: user, parse_state: "pending")

    result = call(material_id: unparsed.id)
    expect(result.failure.code).to eq(:VALIDATION_FAILED)
    expect(completions).to be_empty
  end

  it "refuses a parsed material without sections" do
    empty = create(:material, user: user, parse_state: "parsed", sections: [])

    result = call(material_id: empty.id)
    expect(result.failure.code).to eq(:VALIDATION_FAILED)
    expect(completions).to be_empty
  end

  it "refuses a generated lesson as the source (the 源池排他 law — lessons never feed lessons)" do
    lesson = create(:material, user: user, origin: "generated", parse_state: "parsed", sections: material.sections)

    result = call(material_id: lesson.id)
    expect(result.failure.code).to eq(:VALIDATION_FAILED)
    expect(completions).to be_empty
  end

  it "answers uniform NOT_FOUND for a foreign or malformed material id (never an existence leak)" do
    foreign = create(:material, parse_state: "parsed", sections: material.sections)

    expect(call(material_id: foreign.id).failure.code).to eq(:NOT_FOUND)
    expect(call(material_id: "not-a-uuid").failure.code).to eq(:NOT_FOUND)
    expect(completions).to be_empty
  end

  it "refuses an invalid language before anything is spent (AD-16 — one parameter, one policy)" do
    expect(call(language: "fr").failure.code).to eq(:VALIDATION_FAILED)
    expect(completions).to be_empty
  end

  it "carries CAP_REACHED through from the seam untouched" do
    create(:ai_usage_counter, user: user, call_count: 50)

    expect(call.failure.code).to eq(:CAP_REACHED)
  end
end
