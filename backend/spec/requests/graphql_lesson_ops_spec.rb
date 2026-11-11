# frozen_string_literal: true

require "rails_helper"

RSpec.describe "GraphQL lesson ops (epic-36 T1 — the generated-lesson wire surface)", type: :request do
  # The wire shapes: the lessonEstimate query (the template constants' ONLY
  # GraphQL window — entry + confirm pages share it), the proposeLessonOutline
  # mutation (the outline gate's payload + the exact estimate), the
  # createLesson mutation (both shapes, the delta-3 replay, the error-code
  # mapping), Material.origin/generation + MaterialSection.anchors on the
  # wire, and the createStreamTicket lesson op. The commands underneath have
  # their own direct specs; the adapter is stubbed at the seam.
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

  let(:adapter) { double("client") }

  before do
    allow(Ai::Provider).to receive(:adapter).and_return(adapter)
  end

  let(:user) { User.find_by!(email: "lesson-ops@example.com") }
  let(:token) { token_for("lesson-ops@example.com") }
  let(:password) { "known-password-123" }

  before do
    create(:user, email: "lesson-ops@example.com", password: password)
  end

  let(:source) do
    create(:material, user: user, plan: create(:study_plan, user: user), parse_state: "parsed", title: "Distributed notes", sections: [
      { "id" => "sec-1", "title" => "Raft", "text" => "leader election and log replication" },
      { "id" => "sec-2", "title" => "Chains", "text" => "chain replication passes writes down a chain" }
    ])
  end

  describe "the lessonEstimate query" do
    def estimate_query(variant, section_count: nil)
      graphql(<<~GRAPHQL, token: token)
        query {
          lessonEstimate(variant: "#{variant}"#{section_count ? ", sectionCount: #{section_count}" : ""}) {
            outlineCalls sectionsMin sectionsMax totalMin totalMax
          }
        }
      GRAPHQL
    end

    it "carries the node template band and the material template range" do
      node = estimate_query("node")
      expect(node.dig("data", "lessonEstimate")).to eq(
        "outlineCalls" => Ai::Lessons::NODE_OUTLINE_CALLS,
        "sectionsMin" => Ai::Lessons::NODE_SECTION_MIN,
        "sectionsMax" => Ai::Lessons::NODE_SECTION_MAX,
        "totalMin" => Ai::Lessons::NODE_OUTLINE_CALLS + Ai::Lessons::NODE_SECTION_MIN,
        "totalMax" => Ai::Lessons::NODE_OUTLINE_CALLS + Ai::Lessons::NODE_SECTION_MAX
      )

      material = estimate_query("material")
      expect(material.dig("data", "lessonEstimate")).to eq(
        "outlineCalls" => Ai::Lessons::MATERIAL_OUTLINE_CALLS,
        "sectionsMin" => 1,
        "sectionsMax" => Ai::Lessons::MATERIAL_MAX_SECTIONS,
        "totalMin" => Ai::Lessons::MATERIAL_OUTLINE_CALLS + 1,
        "totalMax" => Ai::Lessons::MATERIAL_OUTLINE_CALLS + Ai::Lessons::MATERIAL_MAX_SECTIONS
      )
    end

    it "pins the exact count for a confirmed outline size and refuses an unknown variant with the closed code" do
      exact = estimate_query("material", section_count: 3)
      expect(exact.dig("data", "lessonEstimate")).to include("totalMin" => 4, "totalMax" => 4)

      unknown = estimate_query("book")
      aggregate_failures do
        expect(unknown.dig("data", "lessonEstimate")).to be_nil
        expect(error_code(unknown)).to eq("VALIDATION_FAILED")
      end
    end
  end

  describe "the proposeLessonOutline mutation" do
    def propose(material_id: source.id, language: "zh", auth_token: token)
      graphql(<<~GRAPHQL, token: auth_token)
        mutation {
          proposeLessonOutline(input: { materialId: "#{material_id}", language: "#{language}" }) {
            outline { title sourceSectionIds }
            estimatedCalls
          }
        }
      GRAPHQL
    end

    before do
      allow(adapter).to receive(:complete).and_return({ chapters: [
        { title: "Raft 选举", sourceSectionIds: [ "sec-1" ] },
        { title: "链式复制", sourceSectionIds: [ "sec-2" ] }
      ] }.to_json)
    end

    it "returns the outline + the exact estimate for the proposed size" do
      result = propose
      aggregate_failures do
        expect(result.dig("data", "proposeLessonOutline", "outline")).to eq([
          { "title" => "Raft 选举", "sourceSectionIds" => [ "sec-1" ] },
          { "title" => "链式复制", "sourceSectionIds" => [ "sec-2" ] }
        ])
        expect(result.dig("data", "proposeLessonOutline", "estimatedCalls")).to eq(3)
      end
    end

    it "maps the command's failures onto the closed codes (unparsed source → VALIDATION_FAILED, foreign → NOT_FOUND)" do
      unparsed = create(:material, user: user, parse_state: "pending")
      expect(error_code(propose(material_id: unparsed.id))).to eq("VALIDATION_FAILED")

      foreign = create(:material, parse_state: "parsed", sections: source.sections)
      expect(error_code(propose(material_id: foreign.id))).to eq("NOT_FOUND")
      expect(error_code(propose(auth_token: nil))).to eq("UNAUTHORIZED")
    end
  end

  describe "the createLesson mutation" do
    def create_node_lesson(plan_id:, node_id:, client_uuid: SecureRandom.uuid, auth_token: token)
      graphql(<<~GRAPHQL, token: auth_token)
        mutation {
          createLesson(input: { clientUuid: "#{client_uuid}", language: "zh", planId: "#{plan_id}", nodeId: "#{node_id}" }) {
            material {
              id origin kind parseState title attachmentScope nodeId planId
              generation { variant sourceMaterialIds pausedKind generatedAt outline { id title status anchors { materialId sectionId } } }
              sections { id title text anchors { materialId sectionId } }
            }
          }
        }
      GRAPHQL
    end

    def create_material_lesson(client_uuid: SecureRandom.uuid, auth_token: token)
      graphql(<<~GRAPHQL, token: auth_token)
        mutation {
          createLesson(input: {
            clientUuid: "#{client_uuid}", language: "zh", materialId: "#{source.id}",
            outline: [
              { title: "Raft 选举", sourceSectionIds: ["sec-1"] },
              { title: "链式复制", sourceSectionIds: ["sec-2"] }
            ]
          }) {
            material { id origin generation { variant outline { id title status anchors { materialId sectionId } } } }
          }
        }
      GRAPHQL
    end

    let(:plan) { source.plan }
    let(:node) { create(:knowledge_node, user: user, plan: plan, title: "Raft 选举", order: 0) }

    before do
      create(:material_node_mapping, :confirmed, user: user, material: source, node: node, section_id: "sec-1")
      allow(adapter).to receive(:complete).and_return({ chapters: [
        { title: "选举与日志", sourceSectionIds: [ "sec-1" ] }
      ] }.to_json)
    end

    it "creates the ② lesson with the full wire shape (origin, generation placeholders, anchors)" do
      result = create_node_lesson(plan_id: plan.id, node_id: node.id)
      material = result.dig("data", "createLesson", "material")
      aggregate_failures do
        expect(material["origin"]).to eq("generated")
        expect(material["kind"]).to eq("markdown")
        expect(material["parseState"]).to eq("parsed")
        expect(material["attachmentScope"]).to eq("node")
        expect(material["nodeId"]).to eq(node.id)
        expect(material["planId"]).to eq(plan.id)
        generation = material["generation"]
        expect(generation["variant"]).to eq("node")
        expect(generation["sourceMaterialIds"]).to eq([ source.id ])
        expect(generation["pausedKind"]).to be_nil
        expect(generation["generatedAt"]).to be_present
        chapter = generation["outline"].sole
        expect(chapter.slice("id", "title", "status")).to eq({ "id" => "ch-1", "title" => "选举与日志", "status" => "pending" })
        expect(chapter["anchors"]).to eq([ { "materialId" => source.id, "sectionId" => "sec-1" } ])
        expect(material["sections"]).to eq([])
      end
    end

    it "creates the ① lesson from the echoed outline with no provider call" do
      result = create_material_lesson
      material = result.dig("data", "createLesson", "material")
      aggregate_failures do
        expect(material["origin"]).to eq("generated")
        expect(material.dig("generation", "variant")).to eq("material")
        expect(material.dig("generation", "outline").first["anchors"]).to eq([ { "materialId" => source.id, "sectionId" => "sec-1" } ])
        expect(material.dig("generation", "outline").length).to eq(2)
      end
      expect(adapter).not_to have_received(:complete)
    end

    it "maps the command's failures onto the closed codes" do
      lonely = create(:knowledge_node, user: user, plan: plan, title: "Lonely", order: 1)
      expect(error_code(create_node_lesson(plan_id: plan.id, node_id: lonely.id))).to eq("VALIDATION_FAILED")

      expect(error_code(create_node_lesson(plan_id: "not-a-uuid", node_id: node.id))).to eq("NOT_FOUND")
      expect(error_code(create_node_lesson(plan_id: plan.id, node_id: node.id, auth_token: nil))).to eq("UNAUTHORIZED")

      bad_echo = graphql(<<~GRAPHQL, token: token)
        mutation {
          createLesson(input: {
            clientUuid: "#{SecureRandom.uuid}", language: "zh", materialId: "#{source.id}",
            outline: [ { title: "同名", sourceSectionIds: ["sec-1"] }, { title: "同名", sourceSectionIds: ["sec-2"] } ]
          }) { material { id } }
        }
      GRAPHQL
      expect(error_code(bad_echo)).to eq("VALIDATION_FAILED")
    end

    it "replays the client uuid deterministically on the wire" do
      uuid = SecureRandom.uuid
      first = create_node_lesson(plan_id: plan.id, node_id: node.id, client_uuid: uuid)
      replayed = create_node_lesson(plan_id: plan.id, node_id: node.id, client_uuid: uuid)

      expect(replayed.dig("data", "createLesson", "material", "id")).to eq(first.dig("data", "createLesson", "material", "id"))
      expect(adapter).to have_received(:complete).once
    end
  end

  describe "the Material lesson fields on the wire" do
    it "exposes origin/generation on Material and anchors on its sections (uploaded rows: origin uploaded, generation null, anchors null)" do
      lesson = create(:material, user: user, origin: "generated", parse_state: "parsed", size_bytes: 0, sections: [
        { "id" => "ch-1", "title" => "选举", "text" => "grounded body",
          "anchors" => [ { "materialId" => source.id, "sectionId" => "sec-1" } ] }
      ], generation: {
        "variant" => "material", "sourceMaterialIds" => [ source.id ],
        "outline" => [ { "id" => "ch-1", "title" => "选举", "anchors" => [ { "materialId" => source.id, "sectionId" => "sec-1" } ], "status" => "ready" } ],
        "pausedKind" => "cap", "generatedAt" => "2026-11-12T10:00:00+08:00"
      })

      result = graphql(<<~GRAPHQL, token: token)
        query {
          material(id: "#{lesson.id}") {
            origin generation {
              variant sourceMaterialIds pausedKind generatedAt
              outline { id title status anchors { materialId sectionId } }
            }
            sections { id anchors { materialId sectionId } }
          }
          uploaded: material(id: "#{source.id}") { origin generation { variant } sections { id anchors { materialId } } }
        }
      GRAPHQL

      material = result.dig("data", "material")
      aggregate_failures do
        expect(material["origin"]).to eq("generated")
        expect(material["generation"]["pausedKind"]).to eq("cap")
        expect(material["generation"]["generatedAt"]).to eq("2026-11-12T02:00:00Z")
        expect(material["generation"]["outline"].sole["anchors"]).to eq([ { "materialId" => source.id, "sectionId" => "sec-1" } ])
        expect(material["sections"].sole["anchors"]).to eq([ { "materialId" => source.id, "sectionId" => "sec-1" } ])
      end

      uploaded = result.dig("data", "uploaded")
      aggregate_failures do
        expect(uploaded["origin"]).to eq("uploaded")
        expect(uploaded["generation"]).to be_nil
        expect(uploaded["sections"].first).to have_key("anchors")
        expect(uploaded["sections"].first["anchors"]).to be_nil
      end
    end
  end

  describe "the createStreamTicket lesson op" do
    it "mints for an owned generated lesson and refuses a foreign one with NOT_FOUND" do
      lesson = create(:material, user: user, origin: "generated", generation: { "variant" => "material" })
      result = graphql(<<~GRAPHQL, token: token)
        mutation {
          createStreamTicket(input: { op: "lesson", language: "zh", lessonId: "#{lesson.id}" }) { token expiresAt }
        }
      GRAPHQL
      expect(result.dig("data", "createStreamTicket", "token")).to be_present

      foreign = create(:material, origin: "generated", generation: { "variant" => "material" })
      refused = graphql(<<~GRAPHQL, token: token)
        mutation {
          createStreamTicket(input: { op: "lesson", language: "zh", lessonId: "#{foreign.id}" }) { token }
        }
      GRAPHQL
      expect(error_code(refused)).to eq("NOT_FOUND")
    end
  end
end
