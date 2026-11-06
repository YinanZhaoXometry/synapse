# frozen_string_literal: true

require "rails_helper"

# Import::DocumentValidation (epic P3-17 ticket 07 — first direct spec): the
# pure-payload half of ImportDocumentCommand, table-driven over EVERY
# VALIDATION_FAILED leg. The import command spec covers the orchestration
# through a handful of examples; this suite pins each validation rule the
# module owns — id shape/uniqueness, the enum vocabularies, the section cap,
# the AD-2 locator shapes, and the in-document linkage law — so a rule can't
# silently lose its refusal.
RSpec.describe Import::DocumentValidation do
  # The module is mixed into the command (which brings the Failure factory
  # and ReadingLocators); an ApplicationCommand host with the same two
  # inclusions reproduces the exact runtime composition.
  let(:host) do
    Class.new(ApplicationCommand) do
      include Import::DocumentValidation
      include ReadingLocators
    end.new
  end

  def base_document
    uuid = -> { SecureRandom.uuid }
    plan_id = uuid.call
    node_id = uuid.call
    material_id = uuid.call
    task_id = uuid.call
    session_id = uuid.call
    question_id = uuid.call
    {
      plans: [ { id: plan_id, topic: "Topic" } ],
      nodes: [ { id: node_id, plan_id: plan_id, title: "Node", task_id: nil } ],
      materials: [ { id: material_id, plan_id: plan_id, title: "Material", kind: "markdown",
                     parse_state: "parsed", task_id: nil,
                     sections: [ { id: "sec-1", title: "S", text: "body" } ] } ],
      tasks: [ { id: task_id, title: "Task", material_id: material_id, node_id: node_id } ],
      sessions: [ { id: session_id, mode: "open", status: "completed", plan_id: plan_id,
                    task_id: nil, question_ids: [ question_id ] } ],
      questions: [ { id: question_id, session_id: session_id, prompt: "P?", explanation: "E", kind: "open" } ],
      evidence: [ { id: uuid.call, outcome: "correct" } ],
      flashcards: [ { id: uuid.call, front: "F", back: "B", difficulty: nil } ],
      mistakes: [ { id: uuid.call, source_location: { kind: "markdown", section_id: "sec-1" } } ],
      section_markings: [ { id: uuid.call } ],
      reading_progress: [ { material_id: material_id,
                            position: { locator: { kind: "markdown", section_id: "sec-1" }, text: "t" } } ],
      chat_threads: [ { material_id: material_id,
                        messages: [ { id: uuid.call, role: "user", text: "hi", citations: [] } ] } ]
    }
  end

  def document_with
    doc = base_document.deep_dup
    yield doc
    doc
  end

  def expect_validation_failure(document, field:, message: nil)
    result = host.validate_document(document)
    aggregate_failures do
      expect(result).to be_failure
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(result.failure.context[:field]).to eq(field)
      expect(result.failure.context[:message]).to include(message) if message
    end
  end

  it "accepts a clean document (nil — the module's clean contract)" do
    expect(host.validate_document(base_document)).to be_nil
  end

  describe "id shape + uniqueness" do
    it "refuses a non-uuid id" do
      expect_validation_failure(document_with { |d| d[:plans][0][:id] = "not-a-uuid" },
                                field: :plans, message: "id is not uuid-shaped")
    end

    it "refuses duplicate ids within one collection" do
      expect_validation_failure(document_with { |d| d[:flashcards] << d[:flashcards][0].dup },
                                field: :flashcards, message: "duplicate")
    end
  end

  describe "per-entity payload rules" do
    it "refuses a blank plan topic or material title" do
      expect_validation_failure(document_with { |d| d[:plans][0][:topic] = "  " },
                                field: :plans, message: "topic is required")
      expect_validation_failure(document_with { |d| d[:materials][0][:title] = "" },
                                field: :materials, message: "title is required")
    end

    it "refuses invalid material vocabularies (kind, parse state, failure reason)" do
      expect_validation_failure(document_with { |d| d[:materials][0][:kind] = "slides" },
                                field: :materials, message: "kind is invalid")
      expect_validation_failure(document_with { |d| d[:materials][0][:parse_state] = "half-done" },
                                field: :materials, message: "parse state is invalid")
      expect_validation_failure(document_with { |d| d[:materials][0][:parse_failure_reason] = "vibes" },
                                field: :materials, message: "parse failure reason is invalid")
    end

    it "refuses section payloads without an id or beyond the text cap" do
      expect_validation_failure(document_with { |d| d[:materials][0][:sections][0][:id] = " " },
                                field: :materials, message: "section id is required")
      expect_validation_failure(
        document_with { |d| d[:materials][0][:sections][0][:text] = "x" * (Materials::MAX_SECTION_CHARS + 1) },
        field: :materials, message: "character cap"
      )
    end

    it "enforces the session vocabularies and the exactly-one-scope law" do
      expect_validation_failure(document_with { |d| d[:sessions][0][:mode] = "trivia" },
                                field: :sessions, message: "mode is invalid")
      expect_validation_failure(document_with { |d| d[:sessions][0][:status] = "won" },
                                field: :sessions, message: "status is invalid")
      expect_validation_failure(document_with { |d| d[:sessions][0].merge!(plan_id: SecureRandom.uuid,
                                                                           task_id: SecureRandom.uuid) },
                                field: :sessions, message: "exactly one")
      expect_validation_failure(document_with { |d| d[:sessions][0].merge!(plan_id: nil, task_id: nil) },
                                field: :sessions, message: "exactly one")
    end

    it "refuses question payloads without prompt/explanation or with a bad kind" do
      expect_validation_failure(document_with { |d| d[:questions][0][:prompt] = "" },
                                field: :questions, message: "prompt is required")
      expect_validation_failure(document_with { |d| d[:questions][0][:explanation] = " " },
                                field: :questions, message: "explanation is required")
      expect_validation_failure(document_with { |d| d[:questions][0][:kind] = "essay" },
                                field: :questions, message: "kind is invalid")
    end

    it "refuses invalid evidence outcomes and flashcard fields" do
      expect_validation_failure(document_with { |d| d[:evidence][0][:outcome] = "kinda" },
                                field: :evidence, message: "outcome is invalid")
      expect_validation_failure(document_with { |d| d[:flashcards][0][:front] = "" },
                                field: :flashcards, message: "front is required")
      expect_validation_failure(document_with { |d| d[:flashcards][0][:back] = nil },
                                field: :flashcards, message: "back is required")
      expect_validation_failure(document_with { |d| d[:flashcards][0][:difficulty] = "brutal" },
                                field: :flashcards, message: "difficulty is invalid")
    end

    it "validates the AD-2 locator shapes on mistakes, reading progress, and chat citations" do
      expect_validation_failure(document_with { |d| d[:mistakes][0][:source_location] = { kind: "web", url: "x" } },
                                field: :mistakes, message: "kind is invalid")
      expect_validation_failure(
        document_with { |d| d[:mistakes][0][:source_location] = { kind: "pdf", page: "two" } },
        field: :mistakes, message: "positive page number"
      )
      expect_validation_failure(
        document_with { |d| d[:reading_progress][0][:position][:locator] = { kind: "markdown", section_id: " " } },
        field: :readingProgress, message: "needs a section id"
      )
      expect_validation_failure(
        document_with do |d|
          d[:chat_threads][0][:messages][0][:citations] = [ { kind: "pdf" } ]
        end,
        field: :chatThreads, message: "positive page number"
      )
    end

    it "caps reading-position text and polices chat message roles, text, and ids" do
      expect_validation_failure(
        document_with { |d| d[:reading_progress][0][:position][:text] = "x" * (Materials::MAX_SECTION_CHARS + 1) },
        field: :readingProgress, message: "character cap"
      )
      expect_validation_failure(document_with { |d| d[:chat_threads][0][:messages][0][:role] = "system" },
                                field: :chatThreads, message: "role is invalid")
      expect_validation_failure(document_with { |d| d[:chat_threads][0][:messages][0][:text] = " " },
                                field: :chatThreads, message: "text is required")
      expect_validation_failure(document_with { |d| d[:chat_threads][0][:messages][0][:id] = "m-1" },
                                field: :chatThreads, message: "id is not uuid-shaped")
    end
  end

  describe "the in-document linkage law" do
    it "refuses triangle references that leave the document" do
      expect_validation_failure(document_with { |d| d[:nodes][0][:task_id] = SecureRandom.uuid },
                                field: :nodes, message: "does not resolve")
      expect_validation_failure(document_with { |d| d[:materials][0][:task_id] = SecureRandom.uuid },
                                field: :materials, message: "does not resolve")
      expect_validation_failure(document_with { |d| d[:tasks][0][:material_id] = SecureRandom.uuid },
                                field: :tasks, message: "does not resolve")
      expect_validation_failure(document_with { |d| d[:tasks][0][:node_id] = SecureRandom.uuid },
                                field: :tasks, message: "does not resolve")
    end

    it "refuses a task owning two nodes or studying two materials" do
      expect_validation_failure(
        document_with do |d|
          d[:nodes][0][:task_id] = d[:tasks][0][:id] # the ORIGINAL row bears the task...
          second = d[:nodes][0].dup
          second[:id] = SecureRandom.uuid            # ...and a second row bears the SAME task
          d[:nodes] << second
        end,
        field: :nodes, message: "at most one node"
      )
      expect_validation_failure(
        document_with do |d|
          d[:materials][0][:task_id] = d[:tasks][0][:id]
          second = d[:materials][0].dup
          second[:id] = SecureRandom.uuid
          d[:materials] << second
        end,
        field: :materials, message: "at most one material"
      )
    end

    it "keeps every question inside its session's questionIds — uniquely" do
      expect_validation_failure(document_with { |d| d[:questions][0][:session_id] = SecureRandom.uuid },
                                field: :questions, message: "does not resolve")
      expect_validation_failure(document_with { |d| d[:sessions][0][:question_ids] = [] },
                                field: :questions, message: "missing from its session's questionIds")
      expect_validation_failure(
        document_with do |d|
          d[:sessions][0][:question_ids] = [ d[:questions][0][:id], d[:questions][0][:id] ]
        end,
        field: :sessions, message: "duplicate questionIds"
      )
    end
  end
end
