# frozen_string_literal: true

module Ai
  # Prompt construction (AD-16/AD-5, epic P2-5 ticket 03): every AI surface's
  # messages are built HERE, from server-assembled context — the model never
  # sees client prose as instructions. The system prompt carries the
  # materials-sourcing law (NFR-1) and the JSON-only reply contract; each
  # surface's user prompt carries the assembled context and its exact reply
  # schema. The reply language (zh/en) is a prompt parameter on every
  # builder — one parameter, one policy (AD-16).
  module Prompts
    SYSTEM = <<~PROMPT.freeze
      You are Synapse's study AI. You answer strictly from the provided study
      material context — you never invent content that is not grounded in it.
      Guardrails: you are a study companion, hint-first, and you say so
      honestly when the material does not cover a request. You reply ONLY
      with the single JSON object the task specifies — no prose, no code
      fences.
    PROMPT

    QUESTION_TARGET = 5

    # The note surface's word target (FR-40, epic P2-12 T1): a single constant
    # mirroring QUESTION_TARGET's posture, with the prompt's honest floor and
    # ceiling derived from it (the ~800–1200 words band the delta pins).
    NOTE_TARGET = 1_000
    NOTE_MIN_WORDS = NOTE_TARGET - 200
    NOTE_MAX_WORDS = NOTE_TARGET + 200

    # The enrichment marker contract (delta decision 1 — markers-only v1):
    # kinds the model may place, and the EXACT line form the note view parses
    # into placeholder cards and export preserves.
    NOTE_MARKER_KINDS = %w[diagram chart image].freeze

    class << self
      # Quiz generation (ticket 03; targeting epic P2-10 T5): node-attributed
      # (AD-6) + materials-sourced (NFR-1) questions in the scope the command
      # assembled. `quota_plan` is T5's weak-spot selection bias (FR-21): the
      # server-computed per-node question quotas — a selection/weighting layer
      # ONLY, never a new source; sections still cite the assembled context.
      # nil keeps the prompt byte-for-byte identical to the pre-T5 shape.
      def quiz(mode:, language:, context:, question_target: QUESTION_TARGET, quota_plan: nil)
        [ system,
          user(<<~PROMPT)
            Study material context (the ONLY allowed source):
            ---
            #{context.text}
            ---
            #{context_note(context)}#{quota_note(quota_plan)}

            Generate exactly #{question_target} quiz questions from ONLY the material above.
            Mode "#{mode}": #{mode_rule(mode)}
            Every question MUST carry:
            - "nodeId": one of the [node id=…] values above (attribution, AD-6).
            - "kind": "open" or "choice".
            - "prompt", "explanation": the question and its teaching explanation.
            - "sourceMaterialId" + "sourceSectionId": the [material id=…] and [section id=…] the question's answer is grounded in (provenance, FR-18).
            - "keywords": the key terms a correct answer must use (open-answer grading input).
            Choice questions additionally carry "options" (2–4 strings) and "correctOptionIndex" (0-based Integer).
            Write every user-facing string in #{language_word(language)}.

            Reply ONLY with JSON: {"questions":[{"nodeId":"…","kind":"open","prompt":"…","options":null,"correctOptionIndex":null,"sourceMaterialId":"…","sourceSectionId":"…","keywords":["…"],"explanation":"…"}]}
          PROMPT
        ]
      end

      # Flashcard generation (FR-19's one-card-per-section shape): a deck for
      # ONE material's sections.
      def flashcards(language:, context:)
        [ system,
          user(<<~PROMPT)
            Study material context (the ONLY allowed source):
            ---
            #{context.text}
            ---
            #{context_note(context)}

            Generate exactly one flashcard per [section id=…] above: "front" is a question or cue for that section's core idea, "back" is its answer.
            Write every user-facing string in #{language_word(language)}.

            Reply ONLY with JSON: {"cards":[{"front":"…","back":"…"}]}
          PROMPT
        ]
      end

      # Section→node mapping (FR-45, epic P2-10 T1): a material's sections
      # against the plan's existing nodes — map onto node ids, propose new
      # node titles for coverage gaps, and leave truly out-of-scope sections
      # with nulls (the command turns those into explicit Unmapped rows —
      # nothing is silently dropped, the model just declines to place them).
      def mapping(language:, context:)
        [ system,
          user(<<~PROMPT)
            Study material context (the ONLY allowed source):
            ---
            #{context.text}
            ---
            #{context_note(context)}

            Map EVERY [section id=…] above onto the plan's [node id=…] entries. For each section return exactly one entry:
            - The section teaches an existing node's topic → "nodeId" is that node's exact id, "proposedNodeTitle" null.
            - NO existing node covers the section → "proposedNodeTitle" is a short new node title (2–8 words); reuse the SAME title for every section that belongs to one new node. "nodeId" null.
            - The section does not belong to this plan's scope at all → both null.
            Every section id in the index MUST appear exactly once in "mappings" — never drop a section.
            Write every proposedNodeTitle in #{language_word(language)}.

            Reply ONLY with JSON: {"mappings":[{"sectionId":"…","nodeId":"…","proposedNodeTitle":null}]}
          PROMPT
        ]
      end

      # Note generation (FR-40, epic P2-12 T1; delta decisions 1+5): a
      # standalone, exportable Markdown study note assembled from ONLY the
      # context the command gathered (NFR-1). The reply is the Markdown note
      # itself — NOT JSON (the system prompt's JSON contract is overridden by
      # this task's own reply contract, the same way the proposal's tag
      # contract overrides it). Visual enrichment rides as PLACEMENT markers
      # (delta decision 1's markers-only v1): the model decides WHERE a visual
      # aids understanding and emits [[enrich|kind|suggestion]] on its own
      # line; content stays text and no assets are stored in v1.
      # `quota_plan` is T2's weak-spot coverage bias (FR-22, epic P2-12): the
      # server-computed per-node coverage weights — a selection/weighting
      # layer ONLY (FR-21's targeting layer), never a new source; content
      # still comes only from the assembled context. nil keeps the prompt
      # byte-for-byte identical to the T1 shape (pinned full-string-eq in the
      # note command spec).
      def note(language:, context:, quota_plan: nil)
        [ system,
          user(<<~PROMPT)
            Study material context (the ONLY allowed source):
            ---
            #{context.text}
            ---
            #{context_note(context)}#{coverage_note(quota_plan)}

            Write a standalone, exportable Markdown study note from ONLY the material above — a learner must be able to read it without the original material at hand.
            Begin the note with a single level-1 heading ("# …") that names the note; structure it with headings and short paragraphs.
            Aim for #{NOTE_MIN_WORDS}–#{NOTE_MAX_WORDS} words (target: #{NOTE_TARGET}).
            Where a visual would genuinely aid understanding, insert an enrichment marker on its own line, in EXACTLY this form:
            [[enrich|kind|what the visual should show]]
            kind is one of: #{NOTE_MARKER_KINDS.map { |kind| "\"#{kind}\"" }.join(", ")}. Placement is your call — only where a picture truly helps; never place a marker for something the material does not ground.
            Write every user-facing string in #{language_word(language)}.

            Reply ONLY with the Markdown note itself — no code fences, no commentary before or after.
          PROMPT
        ]
      end

      # Open-answer grading (AD-5): grade + rationale against the section the
      # question cites. The keyword-count rule is Phase-1's documented
      # simulated-adapter rule (≥2 hits correct, 1 partial, 0 wrong), passed
      # to the real model verbatim.
      def grade(answer:, keywords:, source_text:, language:)
        [ system,
          user(<<~PROMPT)
            Grade a learner's open answer against its source section.
            Source section (the grading ground truth):
            ---
            #{source_text}
            ---
            Expected key terms: #{keywords.inspect}

            Learner's answer:
            ---
            #{answer}
            ---

            Grade by how many expected key terms the answer correctly uses: 0 terms → "wrong", 1 term → "partial", 2 or more → "correct".
            "rationale": a short teaching explanation of the grade, in #{language_word(language)}.
            "quote": the exact sentence from the source section that best supports the grade (or null if none applies).

            Reply ONLY with JSON: {"outcome":"correct|partial|wrong","rationale":"…","quote":"…"}
          PROMPT
        ]
      end

      # Companion chat (FR-11/12, AD-5): single-turn, grounded on the
      # ReadingPosition the ticket carried. The reply is plain prose — every
      # character streams as token events. The guardrail posture (rung) is
      # REQUEST-derived server-side (escalated → "answer", else "hint") —
      # the ladder rule rides the contract, never the model's mood.
      def companion(question:, position_text:, language:, escalated:, context:)
        [ system,
          user(<<~PROMPT)
            The learner is reading a material. Study material context (the ONLY allowed source):
            ---
            #{context.text}
            ---
            #{context_note(context)}
            Their current reading position text:
            ---
            #{position_text}
            ---

            Their question: #{question}

            #{escalated ? "The learner explicitly asked for the direct answer — give it, grounded and cited." : "Stay hint-first: guide toward the answer rather than dumping it (the ladder rule — the learner can escalate with one click)."}
            Answer ONLY from the material above; if it does not cover the question, say so honestly.
            Write your entire reply in #{language_word(language)}.
          PROMPT
        ]
      end

      # Plan-level companion chat (FR-46, epic P2-12 T3): the companion
      # prompt shape with the plan grounding substituted — no reading-position
      # section (the plan scope carries no ReadingPosition), and an inline
      # citation instruction instead (answers name the material/section they
      # rest on — FR-46's citations without a document). Always hint-first:
      # the plan_companion payload has no escalation flag (delta decision 6),
      # so the ladder input never crosses the ticket.
      def plan_companion(question:, language:, context:)
        [ system,
          user(<<~PROMPT)
            The learner is asking about their whole study plan. Study material context (the ONLY allowed source):
            ---
            #{context.text}
            ---
            #{context_note(context)}
            When an answer rests on specific parts, cite them inline by the material and section names from the context (e.g. 「《…》的「…」一节」 / "the section '…' of '…'").

            Their question: #{question}

            Stay hint-first: guide toward the answer rather than dumping it (the ladder rule).
            Answer ONLY from the material above; if it does not cover the question, say so honestly.
            Write your entire reply in #{language_word(language)}.
          PROMPT
        ]
      end

      # Plan-creation proposal (FR-1/AD-5): topic (+ optional goal) → a
      # staged node proposal. The reply format is the frozen tag contract
      # (ticket 04): a readable outline between the outline tags (what the
      # client streams as tokens) and the strict proposal JSON between the
      # proposal tags (what the terminal event carries — the client's
      # follow-up confirmProposal consumes it verbatim).
      def proposal(topic:, goal:, language:)
        goal_line = goal.to_s.strip.empty? ? "" : "\nThe learner's goal: #{goal}"
        [ system,
          user(<<~PROMPT)
            Design a study plan. Topic: #{topic}.#{goal_line}

            Reply in EXACTLY this format — nothing before, between, or after the tags:
            <outline>
            A short readable outline of the plan: one line per stage ("第 1 阶段：…" / "Stage 1: …"), then its node titles as "- …" lines.
            </outline>
            <proposal>
            {"topic":"#{topic}","stages":[{"name":"…","nodeTitles":["…","…"]}]}
            </proposal>

            2–5 stages, 3–8 nodes total, ordered from foundations to practice.
            Write the outline lines AND the JSON's strings in #{language_word(language)}.
          PROMPT
        ]
      end

      private

      def system
        { role: "system", content: SYSTEM }
      end

      def user(content)
        { role: "user", content: content }
      end

      def language_word(language)
        language == "zh" ? "简体中文" : "English"
      end

      def mode_rule(mode)
        case mode
        when "open" then "every question is kind \"open\" (free-text answer)."
        when "choice" then "every question is kind \"choice\" (options + correctOptionIndex)."
        when "mix" then "include BOTH kinds \"open\" and \"choice\"."
        end
      end

      def context_note(context)
        context.truncated ? "Note: the context above is PARTIAL (truncated to the budget) — cite only sections you can see." : ""
      end

      # T5's weak-spot quota block (FR-21): the deterministic server-side
      # allocation the command computed (Ai::Targeting). Blank → nothing —
      # the pre-T5 prompt shape, byte-for-byte.
      def quota_note(quota_plan)
        return "" if quota_plan.blank?

        <<~NOTE

          Weak-spot quota plan (server-computed from the learner's Mastery Scores and mistake log — distribute EXACTLY):
          #{quota_plan}
          These quotas bias question selection ONLY — every question still cites its [material id=…] + [section id=…] provenance from ONLY the context above (FR-18); never invent content a quota cannot ground.
        NOTE
      end

      # T2's weak-spot coverage block (FR-22, epic P2-12): the deterministic
      # server-side allocation the command computed (Ai::Targeting over the
      # SHARED Ai::TargetingCandidates builder), in the quiz quota table's
      # line shape repurposed for note coverage. Blank → nothing — the T1
      # prompt shape, byte-for-byte (pinned full-string-eq in the note
      # command spec).
      def coverage_note(quota_plan)
        return "" if quota_plan.blank?

        <<~NOTE

          Weak-spot coverage plan (server-computed from the learner's Mastery Scores and mistake log — cover the marked nodes EXACTLY as allotted):
          #{quota_plan}
          This note is aimed at what the learner has not yet demonstrated — cover the marked nodes proportionally to their gaps.
          Content comes from ONLY the context above (NFR-1) — never invent content a quota cannot ground.
        NOTE
      end
    end
  end
end
