# frozen_string_literal: true

require "rails_helper"

# Ai::Prompts (epic P3-17 ticket 07 — first direct spec): the module builds
# EVERY AI surface's messages from server-assembled context (AD-16), and a
# template regression (a lost language switch, a broken JSON contract, a
# missing sourcing law) would silently change model behavior. These specs pin
# the load-bearing contract pieces: the [system, user] shape, the zh/en
# switch, the mode/quota/attribution/coverage optional blocks, the note
# marker + word band, the ladder rule, and byte-identical determinism — not
# the full prose (a wording polish must not red this suite).
RSpec.describe Ai::Prompts do
  # The assembler's result carries exactly what every builder reads.
  Context = Struct.new(:text, :truncated, keyword_init: true)

  let(:context) { Context.new(text: "Raft elects a leader.", truncated: false) }

  it "shapes every message list as [system, user] with the sourcing law + JSON contract pinned" do
    messages = described_class.quiz(mode: "open", language: "zh", context: context)
    aggregate_failures do
      expect(messages.length).to eq(2)
      expect(messages[0][:role]).to eq("system")
      expect(messages[1][:role]).to eq("user")
      expect(messages[0][:content]).to include("strictly from the provided study")
      expect(messages[0][:content]).to include("material context")
      expect(messages[0][:content]).to include("the single JSON object")
    end
  end

  it "carries the assembled context text verbatim and never leaks interpolation" do
    messages = described_class.quiz(mode: "open", language: "zh", context: context)
    content = messages[1][:content]
    aggregate_failures do
      expect(content).to include("Raft elects a leader.")
      expect(content).not_to include('#{')
    end
  end

  it "switches the reply language with the one-parameter policy (zh | en)" do
    zh = described_class.quiz(mode: "open", language: "zh", context: context)[1][:content]
    en = described_class.quiz(mode: "open", language: "en", context: context)[1][:content]
    aggregate_failures do
      expect(zh).to include("简体中文")
      expect(en).to include("English")
    end
  end

  # epic-34 T1's single point: EVERY builder's reply-language line comes from
  # one directive helper — uniform application is the property under test
  # (a builder growing its own hand-written language line would drift).
  it "applies the language directive uniformly on every builder (zh | en)" do
    zh_calls = {
      quiz: { mode: "open", language: "zh", context: context },
      flashcards: { language: "zh", context: context },
      mapping: { language: "zh", context: context },
      note: { language: "zh", context: context },
      study_focus: { language: "zh", context: context },
      today_suggestion: { language: "zh", candidates: [] },
      grade: { answer: "My answer.", keywords: %w[k], source_text: "Raft elects a leader.", language: "zh" },
      companion: { question: "为什么？", position_text: "I am here.", language: "zh", escalated: false, context: context },
      plan_companion: { question: "重点？", language: "zh", context: context },
      proposal: { message: "m", materials: [], language: "zh" },
      lesson_outline: { language: "zh", context: context, material_title: "讲义" },
      lesson_section: { language: "zh", context: context, lesson_title: "Raft 讲义", chapter_title: "选举" }
    }
    aggregate_failures do
      zh_calls.each do |name, kwargs|
        content = described_class.public_send(name, **kwargs)[1][:content]
        expect(content).to include("in 简体中文."), "#{name} lacks the zh language directive"
      end

      en_calls = zh_calls.to_h { |name, kwargs| [ name, kwargs.except(:language).merge(language: "en") ] }
      en_calls.each do |name, kwargs|
        content = described_class.public_send(name, **kwargs)[1][:content]
        expect(content).to include("in English."), "#{name} lacks the en language directive"
        expect(content).not_to include("简体中文"), "#{name} leaked the zh directive on an en call"
      end
    end
  end

  it "states the mode rule for open, choice, and mix" do
    open = described_class.quiz(mode: "open", language: "zh", context: context)[1][:content]
    choice = described_class.quiz(mode: "choice", language: "zh", context: context)[1][:content]
    mix = described_class.quiz(mode: "mix", language: "zh", context: context)[1][:content]
    aggregate_failures do
      expect(open).to include('kind "open" (free-text answer)')
      expect(choice).to include('kind "choice" (options + correctOptionIndex)')
      expect(mix).to include('BOTH kinds "open" and "choice"')
    end
  end

  it "keeps the optional quiz blocks out of the pre-T5/T2 shape when nil" do
    content = described_class.quiz(mode: "open", language: "zh", context: context)[1][:content]
    aggregate_failures do
      expect(content).not_to include("Weak-spot quota plan")
      expect(content).not_to include("attribution map")
    end
  end

  it "embeds the quota and attribution blocks when given — weighting only, never a new source" do
    content = described_class.quiz(mode: "open", language: "zh", context: context,
                                   quota_plan: "- Node X: 3 questions",
                                   attribution_note: [ "- [section id=sec-1] → [node id=n1]" ])[1][:content]
    aggregate_failures do
      expect(content).to include("Weak-spot quota plan")
      expect(content).to include("- Node X: 3 questions")
      expect(content).to include("bias question selection ONLY")
      expect(content).to include("Section→node attribution map")
      expect(content).to include("- [section id=sec-1] → [node id=n1]")
    end
  end

  it "pins the note contract: word band, marker form, kinds, Markdown-only reply, coverage block" do
    plain = described_class.note(language: "zh", context: context)[1][:content]
    aggregate_failures do
      expect(plain).to include("#{described_class::NOTE_MIN_WORDS}–#{described_class::NOTE_MAX_WORDS} words")
      expect(plain).to include("[[enrich|kind|")
      described_class::NOTE_MARKER_KINDS.each { |kind| expect(plain).to include("\"#{kind}\"") }
      expect(plain).to include("Reply ONLY with the Markdown note itself")
      expect(plain).not_to include("Weak-spot coverage plan")
    end

    aimed = described_class.note(language: "zh", context: context, quota_plan: "- Node Y: heavy")[1][:content]
    expect(aimed).to include("Weak-spot coverage plan")
  end

  it "flips the companion ladder on escalation, and plan_companion stays hint-first with citations" do
    hint = described_class.companion(question: "为什么？", position_text: "I am here.",
                                     language: "zh", escalated: false, context: context)[1][:content]
    answer = described_class.companion(question: "为什么？", position_text: "I am here.",
                                       language: "zh", escalated: true, context: context)[1][:content]
    aggregate_failures do
      expect(hint).to include("Stay hint-first")
      expect(hint).not_to include("explicitly asked for the direct answer")
      expect(answer).to include("explicitly asked for the direct answer")
      expect(answer).not_to include("Stay hint-first")
      # The prose-only rule (2026-11-06): GLM answered a hint-first ask with a
      # {"hint": …} JSON object once — both companion prompts now forbid it.
      expect(hint).to include("never JSON")
      expect(answer).to include("never JSON")
    end

    plan = described_class.plan_companion(question: "重点？", language: "en", context: context)[1][:content]
    aggregate_failures do
      expect(plan).to include("Stay hint-first")
      expect(plan).to include("cite them inline")
      expect(plan).to include("never JSON")
    end
  end

  # Node teaching (epic-34 T2, AI 讲解): the optional teach_node directive —
  # names the node being taught; with no usable confirmed mapping the
  # honesty clause rides (say no material is attached, point to
  # upload/mapping, never teach from parametric memory). The directive
  # travels as the assembler's TeachingNode struct (review round), never a
  # bare hash. Absent teach_node keeps the prompt free of the directive
  # (the generic plan companion, byte-neutral).
  it "adds the node-teaching directive to plan_companion only when a teach node rides" do
    plain = described_class.plan_companion(question: "重点？", language: "zh", context: context)[1][:content]
    mapped = described_class.plan_companion(
      question: "请给我讲解这个节点", language: "zh", context: context,
      teach_node: Ai::ContextAssembler::TeachingNode.new(title: "Raft 选举", unmapped: false)
    )[1][:content]
    unmapped = described_class.plan_companion(
      question: "请给我讲解这个节点", language: "zh", context: context,
      teach_node: Ai::ContextAssembler::TeachingNode.new(title: "Raft 选举", unmapped: true)
    )[1][:content]
    aggregate_failures do
      expect(plain).not_to include("TEACHES the node")
      expect(plain).not_to include("no material is attached")
      expect(mapped).to include("TEACHES the node")
      expect(mapped).to include("Raft 选举")
      # the honesty clause is the unmapped node's clause, never a mapped turn's
      expect(mapped).not_to include("no material is attached")
      expect(unmapped).to include("TEACHES the node")
      expect(unmapped).to include("no material is attached")
      expect(unmapped).to include("upload")
      expect(unmapped).to include("NEVER teach the node from your own knowledge")
    end
  end

  it "carries the companion quiz-block contract (epic-24 T4) in companion AND plan_companion" do
    hint = described_class.companion(question: "考考我", position_text: "I am here.",
                                     language: "zh", escalated: false, context: context)[1][:content]
    plan = described_class.plan_companion(question: "quiz me", language: "en", context: context)[1][:content]
    aggregate_failures do
      [ hint, plan ].each do |content|
        expect(content).to include("synapse-quiz")
        expect(content).to include('"kind":"choice"')
        expect(content).to include('"kind":"short"')
        expect(content).to include("never reveal the answer or explanation outside the block")
        expect(content).to include("ONLY from the material above")
        # The 2026-11-10 drift round: bare JSON payloads were reaching the
        # client — the fence is now stated as mandatory, not just implied.
        expect(content).to include("never write the JSON as bare text")
      end
    end
  end

  it "carries the grading inputs and the keyword-count rule verbatim" do
    content = described_class.grade(answer: "My answer.", keywords: %w[leader raft],
                                    source_text: "Raft elects a leader.", language: "en")[1][:content]
    aggregate_failures do
      expect(content).to include("My answer.")
      expect(content).to include(%w[leader raft].inspect)
      expect(content).to include("0 terms → \"wrong\", 1 term → \"partial\", 2 or more → \"correct\"")
    end
  end

  it "pins the study-focus annotation vocabulary and the mapping never-drop law" do
    focus = described_class.study_focus(language: "zh", context: context)[1][:content]
    mapping = described_class.mapping(language: "zh", context: context)[1][:content]
    cards = described_class.flashcards(language: "zh", context: context)[1][:content]
    aggregate_failures do
      expect(focus).to include("[annotation N]")
      expect(focus).to include("about #{described_class::FOCUS_TARGET} core study items")
      expect(mapping).to include("MUST appear exactly once in \"mappings\" — never drop a section")
      expect(cards).to include("exactly one flashcard per [section id=…]")
    end
  end

  it "keeps the proposal's frozen tag contract, message line, and shape bounds (epic-27)" do
    bare = described_class.proposal(message: "Distributed systems for the final exam", materials: [],
                                    language: "zh")[1][:content]
    aggregate_failures do
      expect(bare).to include("<outline>")
      expect(bare).to include("<proposal>")
      # epic-27: the model derives the JSON's short topic from the message.
      expect(bare).to include('"topic":"A short plan title derived from the message"')
      # epic-16 T1 raised the scale cap (grill decision 3) — the prompt says
      # "at most 16 nodes" now, not the pre-epic-16 "3–8".
      expect(bare).to include("2–5 stages, at most 16 nodes total")
      expect(bare).to include("The learner's message: Distributed systems for the final exam")
      expect(bare).not_to include("Study material context")
    end
  end

  it "carries the files-only posture on a blank message (2026-11-10) — the materials alone state the ground" do
    silent = described_class.proposal(message: "", materials: [ { "title" => "讲义", "kind" => "pdf", "text" => "第 1 章" } ],
                                      language: "zh")[1][:content]
    aggregate_failures do
      expect(silent).to include("attached study materials without a message")
      expect(silent).not_to include("The learner's message:")
      expect(silent).to include("Study material context")
    end
  end

  it "renders the materials block (epic-27) and slices it to the prompt budget" do
    with_material = described_class.proposal(
      message: "按这份讲义备考",
      materials: [ { "title" => "复习讲义", "kind" => "pdf", "text" => "第 1 章 集成测试" } ],
      language: "zh",
    )[1][:content]
    aggregate_failures do
      expect(with_material).to include("Study material context")
      expect(with_material).to include("— 复习讲义 (pdf):")
      expect(with_material).to include("第 1 章 集成测试")
    end

    long = described_class.proposal(
      message: "m",
      materials: [ { "title" => "big", "kind" => "markdown", "text" => "x" * (described_class::MAX_PROMPT_MATERIAL_CHARS + 500) } ],
      language: "en",
    )[1][:content]
    expect(long).to include("x" * described_class::MAX_PROMPT_MATERIAL_CHARS)
    expect(long).not_to include("x" * (described_class::MAX_PROMPT_MATERIAL_CHARS + 1))
  end

  it "notes partial context honestly (the truncation note)" do
    truncated = Context.new(text: "partial", truncated: true)
    content = described_class.quiz(mode: "open", language: "zh", context: truncated)[1][:content]
    expect(content).to include("PARTIAL (truncated to the budget)")
  end

  it "is deterministic: identical inputs build byte-identical prompts" do
    a = described_class.quiz(mode: "mix", language: "en", context: context, quota_plan: "- N: 2")
    b = described_class.quiz(mode: "mix", language: "en", context: context, quota_plan: "- N: 2")
    expect(a).to eq(b)
  end

  # The generated-lesson prompts (epic-36 T1, spec decisions 7+8): the
  # outline gate (①) and the single-pass section fill. The load-bearing
  # contract: the sourcing law + the honesty clause (只讲所给源材料 — the
  # lesson is a grounded re-presentation, never parametric writing), the
  # chapter id vocabulary the reply normalization reads, the chapter cap the
  # template pins, and the language directive riding the ONE single point.
  describe "the lesson prompts (epic-36 T1)" do
    it "lesson_outline keeps the sourcing law, the [section id=…] vocabulary, and the template cap" do
      content = described_class.lesson_outline(language: "en", context: context,
                                               material_title: "Distributed notes")[1][:content]
      aggregate_failures do
        expect(content).to include("the ONLY allowed source")
        expect(content).to include("Distributed notes")
        expect(content).to include("sourceSectionIds")
        expect(content).to include("At most #{Ai::Lessons::MATERIAL_MAX_SECTIONS} chapters")
        expect(content).to include("never invent content or ids")
        expect(content).to include('{"chapters":[{"title":"…","sourceSectionIds":["…"]}]}')
        expect(content).to include("in English.")
      end
    end

    it "lesson_section keeps the single-chapter honesty clause and the Markdown streaming contract" do
      content = described_class.lesson_section(language: "zh", context: context,
                                               lesson_title: "Raft 讲义", chapter_title: "选举")[1][:content]
      aggregate_failures do
        expect(content).to include("the ONLY allowed source")
        expect(content).to include("选举")
        expect(content).to include("Raft 讲义")
        expect(content).to include("never parametric writing")
        expect(content).to include("never state a fact the context does not ground")
        expect(content).to include("Reply ONLY with the chapter Markdown itself")
        expect(content).to include("in 简体中文.")
      end
    end

    it "honors a caller-pinned outline target (the node variant's tighter template)" do
      content = described_class.lesson_outline(language: "zh", context: context, material_title: "讲义",
                                               outline_target: Ai::Lessons::NODE_SECTION_MAX)[1][:content]
      expect(content).to include("At most #{Ai::Lessons::NODE_SECTION_MAX} chapters")
    end
  end
end
