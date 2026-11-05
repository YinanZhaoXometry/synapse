# frozen_string_literal: true

require "rails_helper"

# Ai::GenerateStudyFocusCommand (FR-17, epic-13 T4; OQ-1) against a stubbed
# adapter — the Study Focus contract: the material must carry ≥1 annotation
# (the honest gate — there is nothing to distill otherwise, VALIDATION_FAILED
# before anything is spent), the annotations ride the context FIRST with the
# section index after (coherence), ONE cap-counted provider call, the reply's
# sourceAnnotationIndex maps through the SERVER-owned index (out-of-range
# indexes drop the item — an honest count landing below the target),
# replay-on-clientUuid (the same-user replay of the set's last generation
# returns the set untouched WITHOUT a provider call; a foreign uuid is
# VALIDATION_FAILED), and regeneration REPLACES: the same row's items swap
# and the generation counter bumps.
RSpec.describe Ai::GenerateStudyFocusCommand do
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
  let(:material) do
    create(:material, user: user, title: "Raft 讲义", sections: [
      { "id" => "sec-1", "title" => "Leader election", "text" => "Raft elects a leader per term." },
      { "id" => "sec-2", "title" => "Log replication", "text" => "The leader replicates the log." }
    ])
  end
  let!(:annotations) do
    [
      create(:annotation, :markdown, user: user, material: material),
      create(:annotation, :underlined, user: user, material: material, locator: { "kind" => "pdf", "page" => 3 })
    ]
  end
  let(:adapter) { double("client") }
  let(:completions) { [] } # every complete(messages) call's joined prompt text, in order

  before do
    allow(Ai::Provider).to receive(:adapter).and_return(adapter)
    allow(adapter).to receive(:complete) do |messages|
      completions << messages.map { |message| message[:content] }.join
      reply
    end
  end

  # The provider's reply — the prompt's JSON contract: three items, the last
  # one pointing at an out-of-range annotation (index 9 — the material has
  # two). The command's server-owned index map must drop it.
  let(:reply) do
    <<~JSON
      {"items":[
        {"title":"任期与领导者","detail":"每个任期至多选出一个领导者。","sourceAnnotationIndex":1},
        {"title":"日志复制","detail":"领导者负责把日志复制到跟随者。","sourceAnnotationIndex":2},
        {"title":"凭空要点","detail":"这条没有任何标注支撑。","sourceAnnotationIndex":9}
      ]}
    JSON
  end

  def call(material_id: material.id, language: "zh", client_uuid: SecureRandom.uuid)
    described_class.call(
      current_user: user,
      client_uuid: client_uuid,
      language: language,
      material_id: material_id
    )
  end

  describe "input validation (nothing spent on any refusal)" do
    it "refuses an invalid language" do
      result = call(language: "fr")
      expect(result).to be_failure
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(adapter).not_to have_received(:complete)
    end

    it "refuses a non-uuid client uuid (the delta-3 shape refusal)" do
      result = call(client_uuid: "not-a-uuid")
      expect(result).to be_failure
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(result.failure.context[:field]).to eq(:clientUuid)
      expect(adapter).not_to have_received(:complete)
    end
  end

  describe "material resolution (uniform NOT_FOUND — never an existence leak)" do
    it "refuses a malformed id" do
      expect(call(material_id: "nope").failure.code).to eq(:NOT_FOUND)
    end

    it "refuses an unknown id" do
      expect(call(material_id: SecureRandom.uuid).failure.code).to eq(:NOT_FOUND)
    end

    it "refuses a foreign material with the SAME code as an unknown one" do
      foreign = create(:material, user: create(:user))
      expect(call(material_id: foreign.id).failure.code).to eq(:NOT_FOUND)
    end

    it "never reaches the provider on any NOT_FOUND" do
      call(material_id: "nope")
      call(material_id: SecureRandom.uuid)
      expect(adapter).not_to have_received(:complete)
    end
  end

  describe "the annotation gate (FR-17 — there is nothing to distill otherwise)" do
    it "refuses VALIDATION_FAILED when the material has no annotations" do
      material_without_annotations = create(:material, user: user, sections: [
        { "id" => "sec-1", "title" => "Empty", "text" => "nothing marked" }
      ])

      result = call(material_id: material_without_annotations.id)
      expect(result).to be_failure
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(adapter).not_to have_received(:complete)
    end

    it "generates when at least one annotation exists" do
      single = create(:material, user: user, sections: [
        { "id" => "sec-1", "title" => "One", "text" => "one marked span" }
      ])
      create(:annotation, :markdown, user: user, material: single)
      allow(adapter).to receive(:complete).and_return(
        '{"items":[{"title":"唯一要点","detail":"唯一标注的提炼。","sourceAnnotationIndex":1}]}'
      )

      result = call(material_id: single.id)
      expect(result).to be_success
    end
  end

  describe "context assembly (annotations ride FIRST, the section index after)" do
    it "grounds the prompt on the annotations' kinds, addresses, and quotes" do
      call

      prompt = completions.sole
      expect(prompt).to include("[annotations]")
      expect(prompt).to include("kind=highlight")
      expect(prompt).to include("kind=underline")
      expect(prompt).to include("markdown section sec-1")
      expect(prompt).to include("pdf page 3")
      expect(prompt).to include("Scoping, commands, and the spine ER.")
    end

    it "carries the section index for coherence, after the annotations" do
      call

      prompt = completions.sole
      expect(prompt).to include("[section id=sec-1] Leader election")
      expect(prompt.index("[annotations]")).to be < prompt.index("[material id=")
    end

    it "carries the NFR-1 law (distilled from ONLY the annotations) + the reply contract" do
      call

      prompt = completions.sole
      expect(prompt).to include("ONLY")
      expect(prompt).to include("sourceAnnotationIndex")
      expect(prompt).to include("Reply ONLY with JSON")
    end

    it "carries the reply-language policy into the prompt (AD-16 — one parameter, one policy)" do
      call(language: "en")
      expect(completions.sole).to include("English")

      call(language: "zh", client_uuid: SecureRandom.uuid)
      expect(completions.second).to include("简体中文")
    end
  end

  describe "the server-owned index map (an out-of-range index drops the item)" do
    it "lands only the items whose sourceAnnotationIndex names a real annotation" do
      result = call

      expect(result).to be_success
      set = result.value![:study_focus_set]
      expect(set.items.length).to eq(2) # the target was 3 — one dropped, honestly
      expect(set.items.pluck("title")).to eq([ "任期与领导者", "日志复制" ])
    end

    it "maps each survivor's sourceRange to its annotation's range jsonb VERBATIM" do
      result = call
      set = result.value![:study_focus_set]

      expect(set.items[0]["sourceRange"]).to eq(annotations[0].range)
      expect(set.items[1]["sourceRange"]).to eq(annotations[1].range)
    end

    it "drops items missing a usable title or detail (the flashcards normalize posture)" do
      allow(adapter).to receive(:complete).and_return(
        '{"items":[{"title":"  ","detail":"空标题不算。","sourceAnnotationIndex":1},' \
        '{"title":"有标题","detail":"","sourceAnnotationIndex":1}]}'
      )

      result = call
      expect(result).to be_failure
      expect(result.failure.code).to eq(:INTERNAL)
    end

    it "answers INTERNAL when the reply yields zero usable items (a provider-contract violation)" do
      allow(adapter).to receive(:complete).and_return('{"items":[{"title":"x","detail":"y","sourceAnnotationIndex":99}]}')

      result = call
      expect(result).to be_failure
      expect(result.failure.code).to eq(:INTERNAL)
    end
  end

  describe "persistence (one active set per user+material)" do
    it "persists the set with server-minted item ids, the client uuid, and generation 1" do
      uuid = SecureRandom.uuid

      result = call(client_uuid: uuid)
      set = result.value![:study_focus_set]
      aggregate_failures do
        expect(set.user_id).to eq(user.id)
        expect(set.material_id).to eq(material.id)
        expect(set.client_uuid).to eq(uuid)
        expect(set.generation).to eq(1)
        expect(set.items.pluck("id").uniq.length).to eq(2)
        set.items.each do |item|
          expect(item.keys).to contain_exactly("id", "title", "detail", "sourceRange")
        end
      end
    end
  end

  describe "replay-before-spend (delta 3)" do
    it "returns the existing set UNTOUCHED without a provider call on the same client uuid" do
      uuid = SecureRandom.uuid
      first = call(client_uuid: uuid)
      expect(first).to be_success
      original_items = first.value![:study_focus_set].items

      allow(adapter).to receive(:complete).and_return('{"items":[{"title":"NEW","detail":"替换内容。","sourceAnnotationIndex":1}]}')
      replayed = call(client_uuid: uuid)

      expect(replayed).to be_success
      expect(replayed.value![:study_focus_set].id).to eq(first.value![:study_focus_set].id)
      expect(replayed.value![:study_focus_set].items).to eq(original_items)
      expect(replayed.value![:study_focus_set].reload.generation).to eq(1)
      expect(adapter).to have_received(:complete).exactly(:once)
    end

    it "refuses VALIDATION_FAILED when the client uuid belongs to another user's set" do
      other = create(:user)
      create(:study_focus_set, user: other, material: create(:material, user: other))
      foreign_uuid = StudyFocusSet.where(user: other).sole.client_uuid

      # The caller (`user`) sends a uuid owned by `other` — refused before
      # anything is spent, with the ownership field named.
      result = call(client_uuid: foreign_uuid)
      expect(result).to be_failure
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(result.failure.context[:field]).to eq(:clientUuid)
      expect(adapter).not_to have_received(:complete)
    end

    it "answers the replay BEFORE the annotation gate (a retry stays safe after annotations change)" do
      uuid = SecureRandom.uuid
      call(client_uuid: uuid)
      annotations.each(&:destroy!)

      result = call(client_uuid: uuid)
      expect(result).to be_success
      expect(result.value![:study_focus_set].generation).to eq(1)
    end
  end

  describe "regeneration REPLACES (OQ-1 — no forked history)" do
    it "updates the SAME row: fresh items, a bumped generation, and a new replay key" do
      first = call
      set = first.value![:study_focus_set]

      allow(adapter).to receive(:complete).and_return(
        '{"items":[{"title":"新要点","detail":"重新提炼的内容。","sourceAnnotationIndex":2}]}'
      )
      second = call

      expect(second).to be_success
      regenerated = second.value![:study_focus_set]
      aggregate_failures do
        expect(regenerated.id).to eq(set.id)
        expect(StudyFocusSet.count).to eq(1)
        expect(regenerated.generation).to eq(2)
        expect(regenerated.items.pluck("title")).to eq([ "新要点" ])
        expect(regenerated.client_uuid).not_to eq(set.client_uuid)
      end
    end

    it "keeps one set per user+material across many generations" do
      3.times do
        allow(adapter).to receive(:complete).and_return(reply)
        call
      end

      expect(StudyFocusSet.count).to eq(1)
      expect(StudyFocusSet.sole.generation).to eq(3)
    end
  end

  describe "the cap (AD-16)" do
    it "answers CAP_REACHED from the seam before any HTTP" do
      user.ai_usage_counters.create!(day: Date.current, call_count: 50)

      result = call
      expect(result).to be_failure
      expect(result.failure.code).to eq(:CAP_REACHED)
    end
  end
end
