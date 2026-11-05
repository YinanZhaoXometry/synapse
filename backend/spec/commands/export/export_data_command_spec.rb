# frozen_string_literal: true

require "rails_helper"

RSpec.describe Export::ExportDataCommand do
  # Direct command testing (AD-10) — the GraphQL query is a thin boundary
  # over this seam (epic-14 T1, FR-30). The export gathers the caller's WHOLE
  # document in the import's shape (AD-4/AD-15: the document's shape IS the
  # contract, mirrored exactly) so the round trip closes: export →
  # importDocument on a fresh user → equality on the structural
  # counts/content. The produced document is the WIRE shape — string-keyed,
  # camelCase keys (what Types::DocumentInput's arguments are named) — so a
  # client can feed it straight back through the import mutation.
  #
  # Phase-2-only tables (annotations, notes, material↔node mappings, study
  # focus sets, manual tasks) have NO import vocabulary — they cannot ride
  # the round trip and are deliberately absent from the export (recorded in
  # the ticket's fidelity notes), exactly like the import command's own
  # collection list.

  let(:user) { create(:user) }

  # The populated Phase-1 document (the import spec's 14-row graph, verbatim)
  # — imported into `user` so the export reads REAL stored rows: the jsonb
  # shapes as the api actually stores them (string-keyed TS keys), positions
  # derived from questionIds order, message ids verbatim.
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

  let(:old_time) { Time.zone.parse("2026-10-20T09:00:00Z") }
  let(:doc_evidence_time) { Time.zone.parse("2026-10-21T10:30:00Z") }

  def phase_one_document
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

  # GraphQL's input normalization, replayed: a client feeding the exported
  # JSON back through the importDocument mutation gets Types::DocumentInput#to_h
  # — camelCase string keys underscore-and-symbolized, and every DateTime
  # argument coerced from its ISO-8601 wire string to a Time (the import
  # command computes on Time objects — its thread-message re-stamp calls
  # #utc). The keys below are every datetime the document carries.
  DATETIME_KEYS = %i[created_at updated_at completed_at claimed_at cleared_at].freeze

  def to_command_document(value)
    case value
    when Hash
      value.deep_transform_keys { |key| key.to_s.underscore.to_sym }
           .to_h do |key, member|
             [ key, DATETIME_KEYS.include?(key) ? coerce_datetime(member) : to_command_document(member) ]
           end
    when Array
      value.map { |member| to_command_document(member) }
    else
      value
    end
  end

  def coerce_datetime(value)
    return nil if value.nil?

    GraphQL::Types::ISO8601DateTime.coerce_input(value, nil)
  end

  # The owner's association for each wire collection (the structural
  # equality counterweights).
  def collection_model(collection)
    {
      "plans" => :study_plans, "nodes" => :knowledge_nodes, "materials" => :materials,
      "tasks" => :study_tasks, "sessions" => :quiz_sessions, "questions" => :questions,
      "evidence" => :evidence_records, "flashcards" => :flashcards,
      "mistakes" => :mistake_entries, "sectionMarkings" => :section_markings,
      "readingProgress" => :reading_progresses, "chatThreads" => :chat_threads
    }.fetch(collection)
  end

  def export
    described_class.call(current_user: user)
  end

  describe ".call shape — the import's document, wire-keyed" do
    it "returns Success with the version marker and every import collection, string-keyed camelCase" do
      Import::ImportDocumentCommand.call(current_user: user, document: phase_one_document)
      result = export

      aggregate_failures do
        expect(result.success?).to be(true)
        document = result.value![:document]
        expect(document).to be_a(Hash)
        expect(document.keys).to all(be_a(String))
        expect(document["version"]).to eq(1)
        %w[plans nodes materials tasks sessions questions evidence flashcards mistakes
           sectionMarkings readingProgress chatThreads].each do |collection|
          expect(document).to have_key(collection)
          expect(document[collection]).to be_an(Array)
        end
      end
    end

    it "carries no onboardingComplete — the api holds no onboarding state (the import argument is advisory)" do
      expect(export.value![:document]).not_to have_key("onboardingComplete")
    end

    it "answers Success with all-empty collections for a fresh user" do
      result = export

      aggregate_failures do
        expect(result.success?).to be(true)
        document = result.value![:document]
        %w[plans nodes materials tasks sessions questions evidence flashcards mistakes
           sectionMarkings readingProgress chatThreads].each do |collection|
          expect(document[collection]).to eq([])
        end
      end
    end

    it "carries timestamps as ISO-8601 UTC strings" do
      Import::ImportDocumentCommand.call(current_user: user, document: phase_one_document)

      plan = export.value![:document]["plans"].sole

      expect(plan["createdAt"]).to eq(old_time.utc.iso8601)
    end

    it "derives each session's questionIds from the questions' stored positions (the import reads order off it)" do
      Import::ImportDocumentCommand.call(current_user: user, document: phase_one_document)

      session = export.value![:document]["sessions"].sole

      expect(session["questionIds"]).to eq([ question_id ])
    end

    it "passes the jsonb shapes verbatim: sections, mistake sourceLocation, reading position, chat messages" do
      Import::ImportDocumentCommand.call(current_user: user, document: phase_one_document)
      document = export.value![:document]

      aggregate_failures do
        expect(document["materials"].find { |row| row["id"] == material_id }["sections"]).to eq(
          [ { "id" => "page-1", "title" => "Page 1", "text" => "The extracted text." } ]
        )
        expect(document["mistakes"].sole["sourceLocation"]).to eq({ "kind" => "pdf", "page" => 1 })
        expect(document["readingProgress"].sole["position"]).to eq(
          { "locator" => { "kind" => "pdf", "page" => 1 }, "text" => "The extracted text." }
        )
        expect(document["chatThreads"].sole["messages"]).to eq(
          [ { "id" => message_id, "role" => "user", "text" => "Explain scoping",
              "citations" => [ { "kind" => "pdf", "page" => 1 } ],
              "createdAt" => old_time.utc.iso8601 } ]
        )
      end
    end
  end

  describe ".call scoping — only the caller's rows, ever (FR-4/AD-13)" do
    it "exports none of another user's data, even in the same collections" do
      other = create(:user)
      foreign_plan = create(:study_plan, user: other, topic: "Foreign plan")
      foreign_material = create(:material, user: other, title: "Foreign material")
      Import::ImportDocumentCommand.call(current_user: user, document: phase_one_document)

      document = export.value![:document]
      every_id = %w[plans nodes materials tasks sessions questions evidence flashcards mistakes
                    sectionMarkings].flat_map { |collection| document[collection].map { |row| row["id"] } }
      every_address = document["readingProgress"].map { |row| row["materialId"] } +
                      document["chatThreads"].map { |row| row["materialId"] }

      aggregate_failures do
        expect(every_id).not_to include(foreign_plan.id, foreign_material.id)
        expect(every_address).not_to include(foreign_material.id)
        expect(document["plans"].sole["topic"]).to eq("COMP5241 revision")
      end
    end
  end

  describe "the round trip: export → importDocument on a fresh user → equality (the AC)" do
    # The import's FR-4 ownership law (any uuid owned by another user →
    # VALIDATION_FAILED) gives the round trip its honest semantic: the
    # document lands where its client uuids are UNOWNED — a restore into the
    # vacated id space (the original account's rows gone), never concurrent
    # two-account sharing. The specs free the original rows leaf-first (the
    # FKs restrict, and no cascade exists) before the fresh import.
    def free_the_document_ids(owner)
      # Class-level scoped deletes: an association-scoped delete_all would
      # NULLIFY the FKs (the has_many default), not remove the rows. The
      # task↔node↔material triangle is circular (materials.node_id → nodes,
      # nodes.task_id → tasks, tasks.node_id/material_id → both), so its
      # links are broken first — then every table deletes leaf-first over
      # the restricting FKs.
      EvidenceRecord.where(user_id: owner.id).delete_all
      MistakeEntry.where(user_id: owner.id).delete_all
      Question.where(user_id: owner.id).delete_all
      Flashcard.where(user_id: owner.id).delete_all
      SectionMarking.where(user_id: owner.id).delete_all
      ReadingProgress.where(user_id: owner.id).delete_all
      ChatThread.where(user_id: owner.id).delete_all
      QuizSession.where(user_id: owner.id).delete_all
      # Break the triangle's nullable legs (the task's own FKs are NOT NULL
      # and just dictate the delete order: tasks first, then materials and
      # nodes, plans last).
      Material.where(user_id: owner.id).update_all(task_id: nil, node_id: nil)
      KnowledgeNode.where(user_id: owner.id).update_all(task_id: nil)
      StudyTask.where(user_id: owner.id).delete_all
      Material.where(user_id: owner.id).delete_all
      KnowledgeNode.where(user_id: owner.id).delete_all
      StudyPlan.where(user_id: owner.id).delete_all
    end

    it "rebuilds the whole graph under the same client uuids with equal counts and content" do
      Import::ImportDocumentCommand.call(current_user: user, document: phase_one_document)

      exported = export.value![:document]
      # Snapshot the structural counts BEFORE the id space is freed (the
      # freed rows are the equality target).
      original_counts = {
        "plans" => user.study_plans.count, "nodes" => user.knowledge_nodes.count,
        "materials" => user.materials.count, "tasks" => user.study_tasks.count,
        "sessions" => user.quiz_sessions.count, "questions" => user.questions.count,
        "evidence" => user.evidence_records.count, "flashcards" => user.flashcards.count,
        "mistakes" => user.mistake_entries.count, "sectionMarkings" => user.section_markings.count,
        "readingProgress" => user.reading_progresses.count, "chatThreads" => user.chat_threads.count
      }
      free_the_document_ids(user)
      fresh = create(:user)
      result = Import::ImportDocumentCommand.call(current_user: fresh, document: to_command_document(exported))

      aggregate_failures do
        expect(result.success?).to be(true)
        expect(result.value![:imported]).to eq(14)
        expect(result.value![:skipped]).to eq(0)
      end

      # Structural equality — every collection count matches.
      aggregate_failures do
        original_counts.each do |collection, count|
          expect(exported[collection].size).to eq(count)
          expect(exported[collection].size).to be_positive
          expect(fresh.public_send(collection_model(collection)).count).to eq(count)
        end
      end

      # Content equality — the fresh user's rows carry the same uuids,
      # linkage, payloads, and history timestamps.
      aggregate_failures do
        expect(fresh.study_plans.find(plan_id).topic).to eq("COMP5241 revision")
        expect(fresh.study_plans.find(plan_id).goal).to eq("Exam ready")
        expect(fresh.study_plans.find(plan_id).created_at).to be_within(1.second).of(old_time)
        expect(fresh.knowledge_nodes.find(node_id).plan_id).to eq(plan_id)
        expect(fresh.knowledge_nodes.find(node_id).stage).to eq("基础")
        expect(fresh.knowledge_nodes.find(node_id).order).to eq(0)
        expect(fresh.knowledge_nodes.find(task_node_id).task_id).to eq(task_id)
        expect(fresh.materials.find(material_id).sections).to eq(
          [ { "id" => "page-1", "title" => "Page 1", "text" => "The extracted text." } ]
        )
        expect(fresh.materials.find(material_id).size_bytes).to eq(2048)
        expect(fresh.materials.find(task_material_id).task_id).to eq(task_id)
        expect(fresh.study_tasks.find(task_id).material_id).to eq(task_material_id)
        expect(fresh.quiz_sessions.find(session_id).mode).to eq("mix")
        expect(fresh.quiz_sessions.find(session_id).status).to eq("completed")
        expect(fresh.quiz_sessions.find(session_id).completed_at).to be_within(1.second).of(doc_evidence_time)
        expect(fresh.questions.find(question_id).position).to eq(0)
        expect(fresh.questions.find(question_id).keywords).to eq([ "command" ])
        expect(fresh.questions.find(question_id).source_section_id).to eq("page-1")
        expect(fresh.evidence_records.find(evidence_id).created_at).to be_within(1.second).of(doc_evidence_time)
        expect(fresh.evidence_records.find(evidence_id).outcome).to eq("correct")
        expect(fresh.flashcards.find(flashcard_id).difficulty).to eq("hard")
        expect(fresh.mistake_entries.find(mistake_id).forfeited).to be(true)
        expect(fresh.mistake_entries.find(mistake_id).source_location).to eq({ "kind" => "pdf", "page" => 1 })
        expect(fresh.section_markings.find(marking_id).claimed_at).to be_within(1.second).of(old_time)
        expect(fresh.reading_progresses.find_by(material_id: material_id).position).to eq(
          { "locator" => { "kind" => "pdf", "page" => 1 }, "text" => "The extracted text." }
        )
        expect(fresh.chat_threads.find_by(material_id: material_id).messages).to eq(
          [ { "id" => message_id, "role" => "user", "text" => "Explain scoping",
              "citations" => [ { "kind" => "pdf", "page" => 1 } ],
              "createdAt" => old_time.utc.iso8601 } ]
        )
      end
    end

    it "is replay-safe: exporting and re-importing twice skips everything (same uuids, nothing duplicated)" do
      Import::ImportDocumentCommand.call(current_user: user, document: phase_one_document)
      exported = export.value![:document]
      free_the_document_ids(user)
      fresh = create(:user)
      Import::ImportDocumentCommand.call(current_user: fresh, document: to_command_document(exported))

      replay = Import::ImportDocumentCommand.call(current_user: fresh, document: to_command_document(exported))

      aggregate_failures do
        expect(replay.success?).to be(true)
        expect(replay.value![:imported]).to eq(0)
        expect(replay.value![:skipped]).to eq(14)
        expect(fresh.study_plans.count).to eq(1)
        expect(fresh.materials.count).to eq(2)
      end
    end
  end
end
