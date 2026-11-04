# frozen_string_literal: true

require "rails_helper"

RSpec.describe Import::ImportDocumentCommand do
  # Direct command testing (AD-10) — the GraphQL mutation is a thin boundary
  # over this seam. The document hash here is exactly what the mutation feeds
  # (Types::DocumentInput#to_h): symbol-keyed, underscore keys, nested hashes.
  # It mirrors the Phase-1 localStorage document shape (frontend
  # src/data/document.ts SynapseDb) — AD-4/AD-15: the document's shape is the
  # contract, read verbatim. Materials arrive WITHOUT bytes (the re-attach
  # step owns them); section text carries the delta-6 cap.

  let(:user) { create(:user) }

  let(:plan_id) { "11111111-1111-4111-8111-111111111111" }
  let(:node_id) { "22222222-2222-4222-8222-222222222222" }
  let(:material_id) { "33333333-3333-4333-8333-333333333333" }
  let(:task_id) { "44444444-4444-4444-8444-444444444444" }
  let(:task_node_id) { "55555555-5555-4555-8555-555555555555" }
  let(:task_material_id) { "66666666-6666-4666-8666-666666666666" }
  let(:session_id) { "77777777-7777-4777-8777-777777777777" }
  let(:question_id) { "88888888-8888-4888-8888-888888888888" }
  let(:evidence_id) { "99999999-9999-4999-8999-999999999999" }
  let(:flashcard_id) { "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }
  let(:mistake_id) { "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }
  let(:marking_id) { "cccccccc-cccc-4ccc-8ccc-cccccccccccc" }
  let(:message_id) { "ffff0000-0000-4000-8000-000000000001" }

  # A populated Phase-1 document — every collection, every linkage, exactly
  # the live doc's keys; the graph is self-consistent (the task triangle is
  # carried whole, as a real snapshot always is). `created_at` values are
  # frozen to a past week so the timestamp-preservation pins are observable.
  # 14 rows total: plan, node ×2, material ×2, task, session, question,
  # evidence, flashcard, mistake, marking, reading progress, chat thread.
  let(:old_time) { Time.zone.parse("2026-10-20T09:00:00Z") }
  let(:doc_evidence_time) { Time.zone.parse("2026-10-21T10:30:00Z") }

  def document
    {
      version: 1,
      onboarding_complete: true,
      plans: [
        { id: plan_id, topic: "COMP5241 revision", goal: "Exam ready", created_at: old_time }
      ],
      nodes: [
        { id: node_id, plan_id: plan_id, task_id: nil, stage: "基础", title: "Scoping",
          order: 0, created_at: old_time },
        { id: task_node_id, plan_id: nil, task_id: task_id, stage: nil,
          title: "Lecture 1 task node", order: 0, created_at: old_time }
      ],
      materials: [
        { id: material_id, title: "Lecture 1.pdf", kind: "pdf", size_bytes: 2048,
          plan_id: plan_id, task_id: nil, parse_state: "parsed", parse_failure_reason: nil,
          sections: [ { id: "page-1", title: "Page 1", text: "The extracted text." } ],
          created_at: old_time },
        { id: task_material_id, title: "Task notes.md", kind: "markdown", size_bytes: 512,
          plan_id: nil, task_id: task_id, parse_state: "parsed", parse_failure_reason: nil,
          sections: [ { id: "sec-1", title: "Sec", text: "Task notes text." } ],
          created_at: old_time }
      ],
      tasks: [
        { id: task_id, material_id: task_material_id, node_id: task_node_id, created_at: old_time }
      ],
      sessions: [
        { id: session_id, plan_id: plan_id, task_id: nil, mode: "mix", status: "completed",
          question_ids: [ question_id ], created_at: old_time, completed_at: doc_evidence_time }
      ],
      questions: [
        { id: question_id, session_id: session_id, node_id: node_id, kind: "open",
          prompt: "What scoping a command?", options: nil, correct_option_index: nil,
          source_material_id: material_id, source_section_id: "page-1",
          keywords: [ "command" ], explanation: "AD-12 is the answer." }
      ],
      evidence: [
        { id: evidence_id, node_id: node_id, session_id: session_id, question_id: question_id,
          outcome: "correct", created_at: doc_evidence_time }
      ],
      flashcards: [
        { id: flashcard_id, material_id: material_id, node_id: node_id,
          front: "What is AD-12?", back: "Command-layer-first", difficulty: "hard",
          created_at: old_time }
      ],
      mistakes: [
        { id: mistake_id, question_id: question_id, session_id: session_id, node_id: node_id,
          user_answer: "something wrong", source_location: { kind: "pdf", page: 1, section_id: nil },
          forfeited: true, created_at: old_time }
      ],
      reading_progress: [
        { material_id: material_id,
          position: { locator: { kind: "pdf", page: 1, section_id: nil }, text: "The extracted text." },
          updated_at: old_time }
      ],
      chat_threads: [
        { material_id: material_id,
          messages: [ { id: message_id, role: "user", text: "Explain scoping",
                       citations: [ { kind: "pdf", page: 1, section_id: nil } ],
                       created_at: old_time } ],
          updated_at: old_time }
      ],
      section_markings: [
        { id: marking_id, material_id: material_id, section_id: "page-1",
          claimed_at: old_time, cleared_at: nil }
      ]
    }
  end

  def call(overrides = {})
    described_class.call(**{ current_user: user, document: document }.merge(overrides))
  end

  describe ".call" do
    it "imports the whole populated document in one pass: every row lands under its client uuid" do
      result = call

      expect(result.success?).to be(true)
      plan = user.study_plans.find(plan_id)
      node = user.knowledge_nodes.find(node_id)
      material = user.materials.find(material_id)
      task = user.study_tasks.find(task_id)
      session = user.quiz_sessions.find(session_id)
      question = user.questions.find(question_id)
      evidence = user.evidence_records.find(evidence_id)
      flashcard = user.flashcards.find(flashcard_id)
      mistake = user.mistake_entries.find(mistake_id)
      marking = user.section_markings.find(marking_id)
      progress = user.reading_progresses.find_by(material_id: material_id)
      thread = user.chat_threads.find_by(material_id: material_id)

      # Cascade integrity — the doc's linkage realized as the associations.
      aggregate_failures do
        expect(plan.topic).to eq("COMP5241 revision")
        expect(plan.goal).to eq("Exam ready")
        expect(plan.knowledge_nodes).to contain_exactly(node)
        expect(node.plan_id).to eq(plan_id)
        expect(material.plan_id).to eq(plan_id)
        expect(plan.materials).to contain_exactly(material)
        expect(material.sections).to eq([ { "id" => "page-1", "title" => "Page 1", "text" => "The extracted text." } ])
        # The task triangle: task → material + node, both back-filled (the
        # factory's insert dance, realized from the doc's own task_id links).
        expect(task.material_id).to eq(task_material_id)
        expect(task.node_id).to eq(task_node_id)
        expect(user.materials.find(task_material_id).task_id).to eq(task_id)
        expect(user.knowledge_nodes.find(task_node_id).task_id).to eq(task_id)
        # Session → plan, question → session with position from the doc's
        # questionIds order, provenance verbatim.
        expect(session.plan_id).to eq(plan_id)
        expect(session.status).to eq("completed")
        expect(session.completed_at).to be_within(1.second).of(doc_evidence_time)
        expect(question.session_id).to eq(session_id)
        expect(question.position).to eq(0)
        expect(question.source_material_id).to eq(material_id)
        expect(question.source_section_id).to eq("page-1")
        # Evidence carries its original timestamp (streak/mastery honesty —
        # the api's Mastery reads created_at).
        expect(evidence.created_at).to be_within(1.second).of(doc_evidence_time)
        expect(evidence.node_id).to eq(node_id)
        expect(flashcard.difficulty).to eq("hard")
        expect(mistake.forfeited).to be(true)
        expect(mistake.source_location).to eq({ "kind" => "pdf", "page" => 1 })
        expect(marking.section_id).to eq("page-1")
        expect(marking.claimed_at).to be_within(1.second).of(old_time)
        expect(progress.position).to eq({ "locator" => { "kind" => "pdf", "page" => 1 }, "text" => "The extracted text." })
        # The thread's messages keep their client-minted ids (AD-12) — the
        # jsonb rows round-trip the Phase-1 transcript verbatim.
        expect(thread.messages.first["id"]).to eq(message_id)
        expect(thread.messages.first["citations"]).to eq([ { "kind" => "pdf", "page" => 1 } ])
      end

      counts = result.value!
      expect(counts[:imported]).to eq(14)
      expect(counts[:skipped]).to eq(0)
    end

    it "imports materials byteless: no ActiveStorage blob attaches (bytes ride the re-attach step)" do
      call

      expect(user.materials.find(material_id).original).not_to be_attached
    end

    it "is idempotent on replay: the same document again skips every row, writes nothing new" do
      first = call
      replay = call

      aggregate_failures do
        expect(first.value![:imported]).to eq(14)
        expect(replay.success?).to be(true)
        expect(replay.value![:imported]).to eq(0)
        expect(replay.value![:skipped]).to eq(14)
        # Row counts stay flat — no duplicates anywhere.
        expect(user.study_plans.count).to eq(1)
        expect(user.materials.count).to eq(2)
        expect(user.quiz_sessions.count).to eq(1)
        expect(user.questions.count).to eq(1)
        expect(user.evidence_records.count).to eq(1)
        expect(user.chat_threads.count).to eq(1)
        expect(user.reading_progresses.count).to eq(1)
      end
    end

    it "merges: importing a doc that partially exists creates only the missing rows" do
      call

      extra_plan_id = "12121212-1212-4212-8212-121212121212"
      merged = document.dup
      merged[:plans] = document[:plans] +
                       [ { id: extra_plan_id, topic: "A later plan", goal: nil, created_at: old_time } ]

      result = call(document: merged)

      aggregate_failures do
        expect(result.success?).to be(true)
        expect(result.value![:imported]).to eq(1)
        expect(result.value![:skipped]).to eq(14)
        expect(user.study_plans.count).to eq(2)
        expect(user.study_plans.find(extra_plan_id).topic).to eq("A later plan")
      end
    end

    it "answers Success for an empty document (nothing to carry)" do
      empty = {
        version: 1, onboarding_complete: false, plans: [], nodes: [], materials: [], tasks: [],
        sessions: [], questions: [], evidence: [], flashcards: [], mistakes: [],
        reading_progress: [], chat_threads: [], section_markings: []
      }

      result = described_class.call(current_user: user, document: empty)

      aggregate_failures do
        expect(result.success?).to be(true)
        expect(result.value![:imported]).to eq(0)
        expect(result.value![:skipped]).to eq(0)
      end
    end

    it "keeps an owned reading-progress row on replay (the upsert never clobbers newer server state)" do
      call
      progress = user.reading_progresses.find_by(material_id: material_id)
      progress.update!(position: { "locator" => { "kind" => "pdf", "page" => 9 }, "text" => "newer server state" })

      replay = call

      aggregate_failures do
        expect(replay.value![:skipped]).to eq(14)
        expect(progress.reload.position).to eq({ "locator" => { "kind" => "pdf", "page" => 9 }, "text" => "newer server state" })
      end
    end

    it "keeps an owned chat thread on replay (transcripts are never duplicated or rewritten)" do
      call
      thread = user.chat_threads.find_by(material_id: material_id)
      frozen_messages = thread.messages

      replay = call

      aggregate_failures do
        expect(replay.success?).to be(true)
        expect(user.chat_threads.count).to eq(1)
        expect(thread.reload.messages).to eq(frozen_messages)
      end
    end

    it "fails VALIDATION_FAILED, writing nothing, when any uuid belongs to another user (FR-4)" do
      other = create(:user)
      foreign_material = create(:material, user: other)

      poisoned = document
      poisoned[:materials][0][:id] = foreign_material.id

      result = call(document: poisoned)

      aggregate_failures do
        expect(result.failure?).to be(true)
        expect(result.failure.code).to eq(:VALIDATION_FAILED)
        # Whole-document atomicity: nothing landed anywhere.
        expect(user.study_plans.count).to eq(0)
        expect(user.materials.count).to eq(0)
        expect(user.quiz_sessions.count).to eq(0)
      end
    end

    it "fails VALIDATION_FAILED for a foreign uuid in any collection (pinned on a flashcard)" do
      other = create(:user)
      foreign_flashcard = create(:flashcard, user: other)

      poisoned = document
      poisoned[:flashcards][0][:id] = foreign_flashcard.id

      result = call(document: poisoned)

      aggregate_failures do
        expect(result.failure?).to be(true)
        expect(result.failure.code).to eq(:VALIDATION_FAILED)
        expect(user.flashcards.count).to eq(0)
        expect(user.study_plans.count).to eq(0)
      end
    end

    it "fails VALIDATION_FAILED for an id that is not uuid-shaped" do
      poisoned = document
      poisoned[:plans][0][:id] = "not-a-uuid"

      result = call(document: poisoned)

      aggregate_failures do
        expect(result.failure?).to be(true)
        expect(result.failure.code).to eq(:VALIDATION_FAILED)
        expect(user.study_plans.count).to eq(0)
      end
    end

    it "fails VALIDATION_FAILED for duplicate ids within one collection" do
      poisoned = document
      poisoned[:plans] += [ { id: plan_id, topic: "twin", goal: nil, created_at: old_time } ]

      result = call(document: poisoned)

      aggregate_failures do
        expect(result.failure?).to be(true)
        expect(result.failure.code).to eq(:VALIDATION_FAILED)
        expect(user.study_plans.count).to eq(0)
      end
    end

    it "fails VALIDATION_FAILED when a section exceeds the 100,000-character cap (kickoff delta 6)" do
      poisoned = document
      poisoned[:materials][0][:sections][0][:text] = "a" * (Materials::MAX_SECTION_CHARS + 1)

      result = call(document: poisoned)

      aggregate_failures do
        expect(result.failure?).to be(true)
        expect(result.failure.code).to eq(:VALIDATION_FAILED)
        expect(user.materials.count).to eq(0)
      end
    end

    it "fails VALIDATION_FAILED when a cross-reference resolves nowhere (question → unknown material)" do
      poisoned = document
      poisoned[:questions][0][:source_material_id] = SecureRandom.uuid

      result = call(document: poisoned)

      aggregate_failures do
        expect(result.failure?).to be(true)
        expect(result.failure.code).to eq(:VALIDATION_FAILED)
        expect(user.questions.count).to eq(0)
        expect(user.study_plans.count).to eq(0) # atomic — no partial import
      end
    end

    it "fails VALIDATION_FAILED when a question id is missing from its session's questionIds" do
      poisoned = document
      poisoned[:sessions][0][:question_ids] = []

      result = call(document: poisoned)

      aggregate_failures do
        expect(result.failure?).to be(true)
        expect(result.failure.code).to eq(:VALIDATION_FAILED)
        expect(user.questions.count).to eq(0)
      end
    end

    it "fails VALIDATION_FAILED when a session has neither planId nor taskId (the ER's ownership law)" do
      poisoned = document
      poisoned[:sessions][0][:plan_id] = nil

      result = call(document: poisoned)

      aggregate_failures do
        expect(result.failure?).to be(true)
        expect(result.failure.code).to eq(:VALIDATION_FAILED)
        expect(user.quiz_sessions.count).to eq(0)
      end
    end

    it "fails VALIDATION_FAILED when a session names both planId and taskId" do
      poisoned = document
      poisoned[:sessions][0][:task_id] = task_id

      result = call(document: poisoned)

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
    end

    it "fails VALIDATION_FAILED for a vocabulary violation (material kind)" do
      poisoned = document
      poisoned[:materials][0][:kind] = "docx"

      result = call(document: poisoned)

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
    end

    it "fails VALIDATION_FAILED for an evidence outcome outside the closed vocabulary" do
      poisoned = document
      poisoned[:evidence][0][:outcome] = "excellent"

      result = call(document: poisoned)

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
    end

    it "fails VALIDATION_FAILED for an invalid mistake locator (pdf without a page)" do
      poisoned = document
      poisoned[:mistakes][0][:source_location] = { kind: "pdf", page: nil, section_id: nil }

      result = call(document: poisoned)

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
    end

    it "fails VALIDATION_FAILED for an invalid chat message role" do
      poisoned = document
      poisoned[:chat_threads][0][:messages][0][:role] = "system"

      result = call(document: poisoned)

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
    end

    it "fails VALIDATION_FAILED when a task references a material outside the document and the owner's rows" do
      # Payload integrity, never a silent link (FR-4): the reference resolves
      # neither within the document nor in the importer's scope — and the
      # same VALIDATION_FAILED a fully-unknown reference gets (no existence
      # leak for the foreign-owned variant either).
      other = create(:user)
      foreign_material = create(:material, user: other)

      poisoned = document
      poisoned[:tasks][0][:material_id] = foreign_material.id

      result = call(document: poisoned)

      aggregate_failures do
        expect(result.failure?).to be(true)
        expect(result.failure.code).to eq(:VALIDATION_FAILED)
        expect(user.study_tasks.count).to eq(0)
      end
    end
  end
end
