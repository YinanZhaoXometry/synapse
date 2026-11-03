# frozen_string_literal: true

require "rails_helper"

RSpec.describe Quiz::CreateSessionCommand do
  # Direct command testing (AD-10) — the GraphQL mutation is a thin boundary
  # over this seam; the HTTP-level behavior is pinned in the request specs.

  let(:user) { create(:user) }
  let(:plan) { create(:study_plan, user: user) }
  let(:node) { create(:knowledge_node, user: user, plan: plan) }
  let(:material) { create(:material, user: user, plan: plan) }
  let(:client_uuid) { SecureRandom.uuid }

  # A choice question + an open question — the two kinds the Phase-1
  # QuestionInput vocabulary carries (frontend/src/data/quiz-repository.ts).
  let(:choice_attrs) do
    {
      node_id: node.id,
      kind: "choice",
      prompt: "Which column scopes every user-owned row?",
      options: [ "user_id", "material_id" ],
      correct_option_index: 0,
      source_material_id: material.id,
      source_section_id: "sec-1",
      keywords: nil,
      explanation: "AD-13: every row carries its owner."
    }
  end
  let(:open_attrs) do
    {
      node_id: node.id,
      kind: "open",
      prompt: "Why does every row carry a user_id?",
      options: nil,
      correct_option_index: nil,
      source_material_id: material.id,
      source_section_id: "sec-1",
      keywords: [ "scoping", "AD-13" ],
      explanation: "Node attribution at generation time (AD-6)."
    }
  end
  let(:questions_attrs) { [ choice_attrs, open_attrs ] }

  def call(overrides = {})
    described_class.call(
      current_user: user,
      client_uuid: client_uuid,
      plan_id: plan.id,
      task_id: nil,
      mode: "mix",
      questions: questions_attrs,
      **overrides
    )
  end

  describe ".call" do
    it "creates the session and its questions in one transaction, attribution stamped per question (AD-6)" do
      result = call

      expect(result.success?).to be(true)
      session = result.value![:session]
      questions = result.value![:questions]

      expect(session.id).to eq(client_uuid)
      expect(session.user_id).to eq(user.id)
      expect(session.plan_id).to eq(plan.id)
      expect(session.task_id).to be_nil
      expect(session.mode).to eq("mix")
      expect(session.status).to eq("active")
      expect(session.completed_at).to be_nil

      expect(questions.map(&:session_id)).to all(eq(session.id))
      expect(questions.map(&:user_id)).to all(eq(user.id))
      expect(questions.map(&:node_id)).to all(eq(node.id))
      expect(questions.length).to eq(2)

      choice = questions[0]
      expect(choice.kind).to eq("choice")
      expect(choice.prompt).to eq("Which column scopes every user-owned row?")
      # jsonb round-trips verbatim TS keys (options is a plain string array).
      expect(choice.options).to eq([ "user_id", "material_id" ])
      expect(choice.correct_option_index).to eq(0)
      expect(choice.source_material_id).to eq(material.id)
      expect(choice.source_section_id).to eq("sec-1")
      expect(choice.explanation).to eq("AD-13: every row carries its owner.")

      open_question = questions[1]
      expect(open_question.kind).to eq("open")
      expect(open_question.keywords).to eq([ "scoping", "AD-13" ])
    end

    it "persists the rows (real, findable through the owner's scope)" do
      result = call

      session = result.value![:session]
      expect(user.quiz_sessions.find(client_uuid)).to eq(session)
      expect(user.questions.where(session_id: session.id).count).to eq(2)
    end

    it "creates a task-scoped session (planId null, taskId set — the plan-free quiz scope)" do
      task = create(:study_task, user: user)

      result = call(plan_id: nil, task_id: task.id)

      expect(result.success?).to be(true)
      expect(result.value![:session].plan_id).to be_nil
      expect(result.value![:session].task_id).to eq(task.id)
    end

    it "is idempotent on replay with the same client uuid (delta 3): Success, same rows, no duplicates" do
      first = call
      replay = call

      expect(replay.success?).to be(true)
      expect(replay.value![:session].id).to eq(first.value![:session].id)
      expect(replay.value![:questions].map(&:id)).to eq(first.value![:questions].map(&:id))
      expect(user.quiz_sessions.where(id: client_uuid).count).to eq(1)
      expect(user.questions.count).to eq(2)
    end

    it "fails VALIDATION_FAILED when the client uuid belongs to another user (never silently link, FR-4)" do
      other = create(:user)
      foreign_session = create(:quiz_session, user: other)

      result = call(client_uuid: foreign_session.id)

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(user.quiz_sessions.count).to eq(0)
      expect(user.questions.count).to eq(0)
    end

    it "fails VALIDATION_FAILED for a client uuid that is not uuid-shaped" do
      result = call(client_uuid: "not-a-uuid")

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(user.quiz_sessions.count).to eq(0)
    end

    it "fails VALIDATION_FAILED when both a plan and a task are named (the ER's exactly-one-owner law)" do
      task = create(:study_task, user: user)

      result = call(task_id: task.id)

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(user.quiz_sessions.count).to eq(0)
    end

    it "fails VALIDATION_FAILED when neither a plan nor a task is named" do
      result = call(plan_id: nil)

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(user.quiz_sessions.count).to eq(0)
    end

    it "fails VALIDATION_FAILED for a mode outside open|choice|mix" do
      result = call(mode: "cloze")

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(user.quiz_sessions.count).to eq(0)
    end

    it "fails VALIDATION_FAILED for an empty question list (a quiz needs at least one question)" do
      result = call(questions: [])

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(user.quiz_sessions.count).to eq(0)
    end

    it "fails VALIDATION_FAILED for a blank prompt or blank explanation" do
      aggregate_failures do
        blank_prompt = call(questions: [ open_attrs.merge(prompt: "  ") ])
        expect(blank_prompt.failure?).to be(true)
        expect(blank_prompt.failure.code).to eq(:VALIDATION_FAILED)

        blank_explanation = call(questions: [ open_attrs.merge(explanation: "") ])
        expect(blank_explanation.failure?).to be(true)
        expect(blank_explanation.failure.code).to eq(:VALIDATION_FAILED)
      end
      expect(user.quiz_sessions.count).to eq(0)
      expect(user.questions.count).to eq(0)
    end

    it "fails VALIDATION_FAILED for a kind outside open|choice" do
      result = call(questions: [ open_attrs.merge(kind: "cloze") ])

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
    end

    it "fails VALIDATION_FAILED for a choice question without usable options or an in-range index" do
      aggregate_failures do
        no_options = call(questions: [ choice_attrs.merge(options: nil) ])
        expect(no_options.failure?).to be(true)
        expect(no_options.failure.code).to eq(:VALIDATION_FAILED)

        single_option = call(questions: [ choice_attrs.merge(options: [ "only" ]) ])
        expect(single_option.failure?).to be(true)
        expect(single_option.failure.code).to eq(:VALIDATION_FAILED)

        out_of_range = call(questions: [ choice_attrs.merge(correct_option_index: 2) ])
        expect(out_of_range.failure?).to be(true)
        expect(out_of_range.failure.code).to eq(:VALIDATION_FAILED)
      end
      expect(user.questions.count).to eq(0)
    end

    it "normalizes an open question's option fields to nil (choice-only fields)" do
      result = call(questions: [ open_attrs.merge(options: [ "stray" ], correct_option_index: 1) ])

      expect(result.success?).to be(true)
      open_question = result.value![:questions].first
      expect(open_question.options).to be_nil
      expect(open_question.correct_option_index).to be_nil
      # keywords stay — open-answer grading reads them (the simulated adapter contract, AD-5).
      expect(open_question.keywords).to eq([ "scoping", "AD-13" ])
    end

    it "answers NOT_FOUND for a foreign, unknown, or malformed node id (delta 2 — attribution is an address)" do
      aggregate_failures do
        foreign_node = call(questions: [ open_attrs.merge(node_id: create(:knowledge_node, user: create(:user)).id) ])
        expect(foreign_node.failure?).to be(true)
        expect(foreign_node.failure.code).to eq(:NOT_FOUND)

        unknown_node = call(questions: [ open_attrs.merge(node_id: SecureRandom.uuid) ])
        expect(unknown_node.failure?).to be(true)
        expect(unknown_node.failure.code).to eq(:NOT_FOUND)

        malformed_node = call(questions: [ open_attrs.merge(node_id: "garbage") ])
        expect(malformed_node.failure?).to be(true)
        expect(malformed_node.failure.code).to eq(:NOT_FOUND)
      end
      expect(user.quiz_sessions.count).to eq(0)
      expect(user.questions.count).to eq(0)
    end

    it "answers NOT_FOUND for a foreign, unknown, or malformed source material id (delta 2 — provenance is an address)" do
      aggregate_failures do
        foreign_material = call(questions: [ open_attrs.merge(source_material_id: create(:material, user: create(:user)).id) ])
        expect(foreign_material.failure?).to be(true)
        expect(foreign_material.failure.code).to eq(:NOT_FOUND)

        unknown_material = call(questions: [ open_attrs.merge(source_material_id: SecureRandom.uuid) ])
        expect(unknown_material.failure?).to be(true)
        expect(unknown_material.failure.code).to eq(:NOT_FOUND)

        malformed_material = call(questions: [ open_attrs.merge(source_material_id: "garbage") ])
        expect(malformed_material.failure?).to be(true)
        expect(malformed_material.failure.code).to eq(:NOT_FOUND)
      end
      expect(user.quiz_sessions.count).to eq(0)
    end

    it "answers NOT_FOUND for a foreign or unknown plan scope (delta 2)" do
      aggregate_failures do
        foreign_plan = call(plan_id: create(:study_plan, user: create(:user)).id)
        expect(foreign_plan.failure?).to be(true)
        expect(foreign_plan.failure.code).to eq(:NOT_FOUND)

        unknown_plan = call(plan_id: SecureRandom.uuid)
        expect(unknown_plan.failure?).to be(true)
        expect(unknown_plan.failure.code).to eq(:NOT_FOUND)
      end
      expect(user.quiz_sessions.count).to eq(0)
    end

    it "answers NOT_FOUND for a foreign or unknown task scope (delta 2)" do
      aggregate_failures do
        foreign_task = call(plan_id: nil, task_id: create(:study_task, user: create(:user)).id)
        expect(foreign_task.failure?).to be(true)
        expect(foreign_task.failure.code).to eq(:NOT_FOUND)

        unknown_task = call(plan_id: nil, task_id: SecureRandom.uuid)
        expect(unknown_task.failure?).to be(true)
        expect(unknown_task.failure.code).to eq(:NOT_FOUND)
      end
      expect(user.quiz_sessions.count).to eq(0)
    end
  end
end
