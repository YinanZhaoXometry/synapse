# frozen_string_literal: true

require "rails_helper"

RSpec.describe Plans::ForkPlanCommand do
  # The Square adopt (FR-39, epic P2-11 T3, OQ-12): copy STRUCTURE ONLY from a
  # publicly_visible source into a new plan owned by the adopter, with the
  # attribution row (forked_from_plan_id + forked_from_topic). Direct command
  # testing (AD-10) — the GraphQL mutation is a thin boundary over this seam;
  # the HTTP-level behavior is pinned in spec/requests/graphql_square_fork_spec.rb.

  let(:owner) { create(:user) }
  let(:adopter) { create(:user) }
  let(:client_uuid) { SecureRandom.uuid }

  # A public source with a three-stage structure — the fork's input shape.
  let!(:source) do
    create(:study_plan, user: owner, topic: "雅思口语 6.5", goal: "六周冲刺",
                        visibility: "public")
  end
  let!(:source_nodes) do
    [
      create(:knowledge_node, user: owner, plan: source, title: "基础·语音", stage: "基础", order: 2),
      create(:knowledge_node, user: owner, plan: source, title: "核心·Part2 素材", stage: "核心", order: 5),
      create(:knowledge_node, user: owner, plan: source, title: "应用·模考", stage: "应用", order: 9)
    ]
  end

  def call(overrides = {})
    described_class.call(
      current_user: adopter,
      source_plan_id: source.id,
      client_uuid: client_uuid,
      **overrides
    )
  end

  describe ".call" do
    it "copies the structure verbatim into a new plan owned by the adopter" do
      result = call

      expect(result.success?).to be(true)
      plan = result.value![:plan]
      nodes = result.value![:nodes]

      expect(plan.user_id).to eq(adopter.id)
      expect(plan.id).to eq(client_uuid)
      expect(plan.topic).to eq("雅思口语 6.5")
      expect(plan.goal).to eq("六周冲刺")
      expect(plan.visibility).to eq("private")

      # Node title/stage/order VERBATIM — order is the source's stored key,
      # not re-derived from the copy position (delta decision 4's shape).
      expect(nodes.map(&:title)).to eq([ "基础·语音", "核心·Part2 素材", "应用·模考" ])
      expect(nodes.map(&:stage)).to eq(%w[基础 核心 应用])
      expect(nodes.map(&:order)).to eq([ 2, 5, 9 ])
      expect(nodes.map(&:plan_id).uniq).to eq([ plan.id ])
      expect(nodes.map(&:user_id).uniq).to eq([ adopter.id ])
    end

    it "sets the attribution row: forked_from_plan_id + the topic snapshot" do
      result = call

      plan = result.value![:plan]
      expect(plan.forked_from_plan_id).to eq(source.id)
      expect(plan.forked_from_topic).to eq("雅思口语 6.5")
    end

    it "keeps the attribution snapshot when the source later renames (copied, not referenced)" do
      call
      source.update!(topic: "renamed later")

      expect(adopter.study_plans.find(client_uuid).forked_from_topic).to eq("雅思口语 6.5")
    end

    it "copies NO adopter-facing content: materials, quiz sessions, evidence, mappings, markings, annotations, notes, mistakes all empty" do
      # Seed every content shape on the SOURCE so the copy has something to leak.
      # Material-scoped rows (materials/annotations/markings) + node-scoped rows
      # (evidence/mappings/questions/mistakes) — the fork copies neither kind.
      material = create(:material, user: owner, plan: source)
      create(:annotation, user: owner, material: material)
      create(:section_marking, user: owner, material: material)
      create(:evidence_record, user: owner, node: source_nodes.first)
      create(:material_node_mapping, user: owner, material: material, node: source_nodes.first)
      create(:note, user: owner, plan: source, scope: "plan")
      create(:mistake_entry, user: owner, node: source_nodes.first, question: create(:question, node: source_nodes.first))

      result = call
      plan = result.value![:plan]
      node_ids = result.value![:nodes].map(&:id)

      aggregate_failures do
        expect(plan.materials).to be_empty
        expect(plan.quiz_sessions).to be_empty
        expect(EvidenceRecord.where(node_id: node_ids)).to be_empty
        expect(MaterialNodeMapping.where(node_id: node_ids)).to be_empty
        expect(Annotation.where(user_id: adopter.id)).to be_empty
        expect(SectionMarking.where(user_id: adopter.id)).to be_empty
        expect(Note.where(node_id: node_ids)).to be_empty
        expect(MistakeEntry.where(node_id: node_ids)).to be_empty
        expect(Question.where(node_id: node_ids)).to be_empty
      end
    end

    it "writes NOTHING back to the source: its content and updated_at stand untouched" do
      material = create(:material, user: owner, plan: source)
      create(:evidence_record, user: owner, node: source_nodes.first)
      source_updated_at = source.reload.updated_at
      material_updated_at = material.reload.updated_at
      evidence_count = EvidenceRecord.where(node_id: source_nodes.first).count

      call

      aggregate_failures do
        expect(source.reload.updated_at).to eq(source_updated_at)
        expect(source.reload.visibility).to eq("public")
        expect(material.reload.updated_at).to eq(material_updated_at)
        expect(source.materials.count).to eq(1)
        expect(EvidenceRecord.where(node_id: source_nodes.first).count).to eq(evidence_count)
        expect(owner.study_plans.count).to eq(1)
      end
    end

    it "is idempotent on replay with the same client uuid: the existing fork returns, no duplicate rows" do
      first = call
      replay = call

      expect(replay.success?).to be(true)
      expect(replay.value![:plan].id).to eq(first.value![:plan].id)
      expect(adopter.study_plans.where(id: client_uuid).count).to eq(1)
      expect(adopter.knowledge_nodes.where(plan_id: client_uuid).count).to eq(3)
      expect(replay.value![:nodes].map(&:id)).to match_array(first.value![:nodes].map(&:id))
    end

    it "answers the replay even after the source flipped private (the replay-first idempotency posture)" do
      call
      source.update!(visibility: "private")

      replay = call

      expect(replay.success?).to be(true)
      expect(replay.value![:plan].id).to eq(client_uuid)
    end

    it "fails VALIDATION_FAILED when the client uuid belongs to another user (never silently link, FR-4)" do
      call
      other = create(:user)

      result = described_class.call(
        current_user: other,
        source_plan_id: source.id,
        client_uuid: client_uuid
      )

      aggregate_failures do
        expect(result.failure?).to be(true)
        expect(result.failure.code).to eq(:VALIDATION_FAILED)
        expect(other.study_plans.count).to eq(0)
      end
    end

    it "fails VALIDATION_FAILED for a client uuid that is not uuid-shaped" do
      result = call(client_uuid: "not-a-uuid")

      aggregate_failures do
        expect(result.failure?).to be(true)
        expect(result.failure.code).to eq(:VALIDATION_FAILED)
        expect(adopter.study_plans.count).to eq(0)
      end
    end

    it "answers uniform NOT_FOUND for private, foreign-private, unknown, and malformed source ids (no existence leak)" do
      owner_private = create(:study_plan, user: owner, topic: "mine, hidden")
      stranger_private = create(:study_plan, user: create(:user), topic: "theirs, hidden")

      shapes = [
        [ "own private", call(source_plan_id: owner_private.id) ],
        [ "foreign private", call(source_plan_id: stranger_private.id) ],
        [ "unknown uuid", call(source_plan_id: SecureRandom.uuid) ],
        [ "malformed", call(source_plan_id: "../../etc/passwd") ]
      ]

      shapes.each do |label, result|
        aggregate_failures do
          expect(result.failure?).to be(true)
          expect(result.failure.code).to eq(:NOT_FOUND)
          expect(result.failure.context[:message]).to eq(shapes.first[1].failure.context[:message])
        end
      end
      expect(adopter.study_plans.count).to eq(0)
    end

    it "refuses with NOT_FOUND when a listed source flips private before the fork lands (the preview-to-fork race)" do
      # The source was public when the adopter browsed; the flip lands before
      # the fork call — the public scope simply no longer addresses the row.
      source.update!(visibility: "private")

      result = call

      aggregate_failures do
        expect(result.failure?).to be(true)
        expect(result.failure.code).to eq(:NOT_FOUND)
        expect(adopter.study_plans.count).to eq(0)
      end
    end

    it "refuses an empty (zero-node) source with VALIDATION_FAILED — the pinned ruling (an empty shell is meaningless to adopt)" do
      empty_source = create(:study_plan, user: owner, topic: "空壳计划", visibility: "public")

      result = call(source_plan_id: empty_source.id)

      aggregate_failures do
        expect(result.failure?).to be(true)
        expect(result.failure.code).to eq(:VALIDATION_FAILED)
        expect(adopter.study_plans.count).to eq(0)
      end
    end

    it "survives the source's deletion: the FK nullifies, the topic snapshot stays" do
      call

      # Hard-delete the source (bypassing nothing — plans delete server-side
      # through DeletePlanCommand, whose cascade reaches the same row).
      source_row = StudyPlan.find(source.id)
      source_row.knowledge_nodes.delete_all
      source_row.delete

      fork = adopter.study_plans.find(client_uuid)
      aggregate_failures do
        expect(fork.forked_from_plan_id).to be_nil
        expect(fork.forked_from_topic).to eq("雅思口语 6.5")
        expect(fork.knowledge_nodes.count).to eq(3)
      end
    end

    it "lets the owner fork their own public plan (the Square is structure-only — identity is irrelevant)" do
      result = described_class.call(
        current_user: owner,
        source_plan_id: source.id,
        client_uuid: client_uuid
      )

      aggregate_failures do
        expect(result.success?).to be(true)
        expect(result.value![:plan].user_id).to eq(owner.id)
        expect(owner.study_plans.count).to eq(2)
      end
    end
  end
end
