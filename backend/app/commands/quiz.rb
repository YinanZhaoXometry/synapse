# frozen_string_literal: true

# The Quiz context (AD-12): quiz-session, question, and evidence operations
# live under app/commands/quiz/ (one directory per context, epic-03 kickoff
# delta 4). The context carries its closed vocabularies — the DB pins the same
# lists with check constraints (epic P2-1 ticket 02), the commands refuse
# outside values with VALIDATION_FAILED before a row is ever attempted.
module Quiz
  # The QuizMode vocabulary (Phase-1 createQuizSession: "open" | "choice" | "mix").
  MODES = %w[open choice mix].freeze

  # The Question kind vocabulary (Phase-1 QuestionInput.kind).
  QUESTION_KINDS = %w[open choice].freeze

  # The Outcome vocabulary (ADR-0001's evidence values; GLOSSARY: a forfeit
  # 「看答案」 grades as wrong). This epic RECORDS outcomes — the 1/0.5/0
  # scoring is epic-04's (AD-14); no command here computes a score.
  OUTCOMES = %w[correct partial wrong].freeze
end
