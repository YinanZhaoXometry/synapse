# frozen_string_literal: true

module Ai
  # GradeOpenAnswer (AD-5/NFR-1, epic P2-5 ticket 03): grade a learner's open
  # answer against the section the question cites — server-side context (the
  # keywords and source text come from the question row, never the client),
  # one provider call, NO persistence. The outcome rides back to the client
  # and becomes evidence through the existing `recordEvidence` flow —
  # matching the Phase-1 shape (grade → results → recordEvidence).
  #
  # A pure computation: the only Failures are the language/args guards, the
  # addressed question (NOT_FOUND), a vanished source section (NOT_FOUND —
  # the material was re-parsed underneath the question), the cap
  # (CAP_REACHED), and an unusable provider reply (INTERNAL).
  class GradeOpenAnswerCommand < ApplicationCommand
    option :current_user
    option :question_id
    option :answer
    option :language

    GradedAnswer = Struct.new(:outcome, :rationale, :citation, keyword_init: true)
    Citation = Struct.new(:locator, :quote, keyword_init: true)

    # The learner's answer is the one unbounded client string that would
    # otherwise reach the provider (the cap bounds calls, not tokens) —
    # bound it like the companion question (epic review finding).
    MAX_ANSWER_CHARS = 20_000

    def call
      return Failure(:VALIDATION_FAILED, { message: "language is invalid", field: :language }) unless Ai::LANGUAGES.include?(language.to_s)
      return Failure(:VALIDATION_FAILED, { message: "the answer exceeds the length bound", field: :answer }) if answer.to_s.length > MAX_ANSWER_CHARS
      return Failure(:NOT_FOUND, { message: "question not found" }) unless question_id.to_s.match?(Accounts::UUID_REGEX)

      question = current_user.questions.find_by(id: question_id)
      return Failure(:NOT_FOUND, { message: "question not found" }) unless question

      material = question.source_material
      section = Ai::ContextAssembler.section_by_id(material, question.source_section_id)
      return Failure(:NOT_FOUND, { message: "the question's source section no longer exists" }) unless section

      keywords = Array(question.keywords).select { |term| term.is_a?(String) && term.strip.present? }
      messages = Ai::Prompts.grade(
        answer: answer.to_s,
        keywords: keywords,
        source_text: section["text"].to_s,
        language: language
      )
      provider = Ai::Provider.complete(user: current_user, messages: messages)
      return provider if provider.failure?

      grade = normalize_grade(provider.value!)
      return Failure(:INTERNAL, { message: "ai grade payload was unusable" }) unless grade

      locator = citation_locator(material, section)
      citation = locator && Citation.new(locator: locator, quote: normalized_quote(grade["quote"]))
      Success(GradedAnswer.new(
        outcome: grade["outcome"],
        rationale: grade["rationale"].to_s,
        citation: citation
      ))
    end

    private

    # The outcome enum-guard: only the Quiz::OUTCOMES vocabulary ever leaves
    # the command (CreateSessionCommand's shape-law, applied to grading).
    def normalize_grade(raw)
      payload = Ai::ResponseParser.extract_json_object(raw)
      return nil unless payload

      parsed = JSON.parse(payload)
      return nil unless parsed.is_a?(Hash)
      return nil unless Quiz::OUTCOMES.include?(parsed["outcome"])
      return nil if parsed["rationale"].to_s.strip.empty?

      parsed
    end

    # The citation locator is built server-side from the material's kind and
    # the cited section's id — the ReadingLocator jsonb shape, string-keyed
    # ({"kind"=>"markdown","sectionId"=>…} | {"kind"=>"pdf","page"=>N}). A pdf
    # section whose id is not page-shaped yields no citation (null) rather
    # than an invalid locator.
    def citation_locator(material, section)
      if material.kind == "pdf"
        page = section["id"].to_s[/\Apage-(\d+)\z/, 1]
        page && { "kind" => "pdf", "page" => page.to_i }
      else
        { "kind" => "markdown", "sectionId" => section["id"] }
      end
    end

    def normalized_quote(quote)
      text = quote.to_s.strip
      text.empty? ? nil : text
    end
  end
end
