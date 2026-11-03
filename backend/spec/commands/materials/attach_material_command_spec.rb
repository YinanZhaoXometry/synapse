# frozen_string_literal: true

require "rails_helper"

RSpec.describe Materials::AttachMaterialCommand do
  # Direct command testing (AD-10) — the GraphQL mutation is a thin boundary
  # over this seam; the HTTP-level behavior is pinned in the request specs.

  let(:user) { create(:user) }
  let(:client_uuid) { SecureRandom.uuid }
  let(:sections) do
    [
      { id: "sec-1", title: "Introduction", text: "Scoping, commands, and the spine ER." },
      { id: "page-2", title: "Page 2", text: "The bounded extracted text of the second section." }
    ]
  end

  def call(overrides = {})
    described_class.call(
      current_user: user,
      client_uuid: client_uuid,
      title: "Distributed systems lecture notes",
      kind: "markdown",
      size_bytes: 12_345,
      plan_id: nil,
      task_id: nil,
      sections: sections,
      parse_state: nil,
      parse_failure_reason: nil,
      **overrides
    )
  end

  describe ".call" do
    it "attaches the material: metadata, sections, and the parse state derived per Phase-1" do
      result = call

      expect(result.success?).to be(true)
      material = result.value![:material]

      expect(material.id).to eq(client_uuid)
      expect(material.user_id).to eq(user.id)
      expect(material.title).to eq("Distributed systems lecture notes")
      expect(material.kind).to eq("markdown")
      expect(material.size_bytes).to eq(12_345)
      # Phase-1 derivation: no parseState given → "parsed" when sections
      # exist, "pending" otherwise (registerMaterial's `??` fallback).
      expect(material.parse_state).to eq("parsed")
      expect(material.parse_failure_reason).to be_nil
      # Sections round-trip as the string-keyed jsonb rows the factories pin.
      expect(material.sections).to eq(
        [
          { "id" => "sec-1", "title" => "Introduction", "text" => "Scoping, commands, and the spine ER." },
          { "id" => "page-2", "title" => "Page 2", "text" => "The bounded extracted text of the second section." }
        ]
      )
    end

    it "derives parse_state 'pending' when no sections were extracted yet" do
      result = call(sections: [])

      expect(result.value![:material].parse_state).to eq("pending")
    end

    it "keeps an explicit parse_state over the derived one" do
      result = call(parse_state: "parsing")

      expect(result.value![:material].parse_state).to eq("parsing")
    end

    it "attaches under a plan (the Phase-1 planIds back-fill, realized as plan_id)" do
      plan = create(:study_plan, user: user)

      result = call(plan_id: plan.id)

      material = result.value![:material]
      expect(material.plan_id).to eq(plan.id)
      expect(plan.materials).to include(material)
    end

    it "keeps the payload verbatim when parseState 'pending' is explicit with sections present" do
      result = call(parse_state: "pending")

      expect(result.value![:material].parse_state).to eq("pending")
    end

    it "persists a failed parse with its reason (the reader's parse(file) outcome)" do
      result = call(sections: [], parse_state: "failed", parse_failure_reason: "corrupt")

      material = result.value![:material]
      expect(material.parse_state).to eq("failed")
      expect(material.parse_failure_reason).to eq("corrupt")
    end

    it "is idempotent on replay with the same client uuid (delta 3): same row, sections not rewritten" do
      first = call
      replay = call(title: "changed title", sections: [ { id: "other", title: "Other", text: "x" } ])

      expect(replay.success?).to be(true)
      expect(replay.value![:material].id).to eq(first.value![:material].id)
      expect(user.materials.where(id: client_uuid).count).to eq(1)
      expect(user.materials.count).to eq(1)
      # A replay is a no-op: the original payload stands (delta 3).
      expect(replay.value![:material].reload.sections.first["id"]).to eq("sec-1")
      expect(replay.value![:material].reload.title).to eq("Distributed systems lecture notes")
    end

    it "fails VALIDATION_FAILED when the client uuid belongs to another user (never silently link, FR-4)" do
      other = create(:user)
      foreign_material = create(:material, user: other)

      result = call(client_uuid: foreign_material.id)

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(user.materials.count).to eq(0)
    end

    it "fails VALIDATION_FAILED for a client uuid that is not uuid-shaped" do
      result = call(client_uuid: "not-a-uuid")

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(user.materials.count).to eq(0)
    end

    it "fails VALIDATION_FAILED for a blank title" do
      result = call(title: "   ")

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(user.materials.count).to eq(0)
    end

    it "fails VALIDATION_FAILED for a kind outside the closed vocabulary" do
      result = call(kind: "docx")

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(user.materials.count).to eq(0)
    end

    it "fails VALIDATION_FAILED for a parse_state outside the closed vocabulary" do
      result = call(parse_state: "queued")

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
    end

    it "fails VALIDATION_FAILED for a parse_failure_reason outside the closed vocabulary" do
      result = call(parse_state: "failed", parse_failure_reason: "timeout")

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
    end

    it "fails VALIDATION_FAILED when a parse_failure_reason arrives without a failed parse state" do
      result = call(parse_state: "parsed", parse_failure_reason: "corrupt")

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(user.materials.count).to eq(0)
    end

    it "fails VALIDATION_FAILED when a section id is blank" do
      result = call(sections: [ { id: "  ", title: "Introduction", text: "text" } ])

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(user.materials.count).to eq(0)
    end

    it "fails VALIDATION_FAILED when a section exceeds the 100,000-character cap (kickoff delta 6)" do
      result = call(sections: [ { id: "sec-1", title: "Huge", text: "a" * (Materials::MAX_SECTION_CHARS + 1) } ])

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(user.materials.count).to eq(0)
    end

    it "accepts a section at exactly the 100,000-character cap" do
      result = call(sections: [ { id: "sec-1", title: "At the cap", text: "a" * Materials::MAX_SECTION_CHARS } ])

      expect(result.success?).to be(true)
      expect(result.value![:material].sections.first["text"].length).to eq(Materials::MAX_SECTION_CHARS)
    end

    it "answers NOT_FOUND for an unknown plan id" do
      result = call(plan_id: SecureRandom.uuid)

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:NOT_FOUND)
      expect(user.materials.count).to eq(0)
    end

    it "answers NOT_FOUND for another user's plan id (uniform NOT_FOUND, delta 2)" do
      foreign_plan = create(:study_plan, user: create(:user))

      result = call(plan_id: foreign_plan.id)

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:NOT_FOUND)
    end

    it "answers NOT_FOUND for a plan id that is not uuid-shaped" do
      result = call(plan_id: "garbage")

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:NOT_FOUND)
    end

    it "answers NOT_FOUND for an unknown or foreign task id" do
      foreign_task = create(:study_task, user: create(:user))

      aggregate_failures do
        expect(call(task_id: SecureRandom.uuid).failure.code).to eq(:NOT_FOUND)
        expect(call(task_id: foreign_task.id).failure.code).to eq(:NOT_FOUND)
        expect(call(task_id: "garbage").failure.code).to eq(:NOT_FOUND)
      end
      expect(user.materials.count).to eq(0)
    end

    it "fails VALIDATION_FAILED when the named task already studies a material" do
      # Every task is born with its material (study_tasks.material_id NOT
      # NULL; the link is back-filled by task creation — Phase-1's
      # createStudyTask does the same), so the one-task-per-material
      # invariant makes this the only reachable taskId outcome on attach.
      task = create(:study_task, user: user)

      result = call(task_id: task.id, client_uuid: SecureRandom.uuid)

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(user.materials.count).to eq(1) # only the factory's own material
    end
  end
end
