# frozen_string_literal: true

require "rails_helper"

# Ai::TaggedReplySplitter (ticket 04's frozen tag contract): outline text
# streams as tokens; the proposal JSON never reaches the token wire and is
# parsed for the terminal event. Tags split across deltas must never leak.
RSpec.describe Ai::TaggedReplySplitter do
  def feed_all(splitter, chunks)
    tokens = []
    chunks.each { |chunk| tokens.concat(splitter.feed(chunk)) }
    tokens
  end

  def proposal_reply(outline, json)
    "<outline>\n#{outline}\n</outline>\n<proposal>\n#{json}\n</proposal>"
  end

  it "streams only the outline and parses the proposal" do
    json = { topic: "软件工程", stages: [ { name: "阶段一", nodeTitles: [ "命令层", "ER 模型" ] } ] }.to_json
    splitter = described_class.new
    tokens = feed_all(splitter, [ proposal_reply("阶段一：基础\n- 命令层", json) ])
    result = splitter.finish

    # The outline streams raw — the model's own trailing newline included.
    expect(tokens.join).to eq("阶段一：基础\n- 命令层\n")
    expect(result[:proposal]).to eq(JSON.parse(json))
  end

  it "never leaks tags when they arrive split across deltas" do
    json = { topic: "t", stages: [ { name: "s", nodeTitles: [ "n" ] } ] }.to_json
    reply = proposal_reply("stage one", json)
    # Split at every awkward point: mid-open-tag, mid-close-tag, mid-JSON.
    splitter = described_class.new
    tokens = []
    reply.chars.each_slice(3) { |slice| tokens.concat(splitter.feed(slice.join)) }
    tokens.concat(splitter.feed(nil)) # a trailing empty delta
    result = splitter.finish

    expect(tokens.join).not_to include("<outline>")
    expect(tokens.join).not_to include("</outline>")
    expect(tokens.join).not_to include("<proposal>")
    expect(tokens.join).to eq("stage one\n")
    expect(result[:proposal]).to eq(JSON.parse(json))
  end

  it "suppresses the leading newline after the outline tag and holds back tag-length fragments" do
    splitter = described_class.new
    tokens = splitter.feed("<outline>\nfirst")
    # Held back: a split "</outline>" prefix may still be arriving — short
    # outlines stream only once the hold margin is passed or the tag closes.
    expect(tokens).to be_empty
    tokens.concat(splitter.feed("ing text that pushes well past the hold margin"))
    expect(tokens.join).to start_with("first")
  end

  it "returns a nil proposal on any contract violation" do
    no_tags = described_class.new
    feed_all(no_tags, [ "just prose, no tags at all" ])
    expect(no_tags.finish[:proposal]).to be_nil

    no_json = described_class.new
    feed_all(no_tags, [ "<outline>x</outline>\n<proposal>not json</proposal>" ])
    expect(no_json.finish[:proposal]).to be_nil

    unterminated = described_class.new
    feed_all(unterminated, [ "<outline>partial outline without close" ])
    expect(unterminated.finish[:proposal]).to be_nil
  end

  it "recovers the recoverable contract misses (fences, riding prose, unescaped content quotes) — corruption still nil" do
    json = { topic: "t", stages: [ { name: "s", nodes: [ { title: "n", description: nil, optional: false } ] } ] }

    fenced = described_class.new
    feed_all(fenced, [ proposal_reply("stage one", "```json\n#{JSON.generate(json)}\n```") ])
    expect(fenced.finish[:proposal]).to eq(JSON.parse(JSON.generate(json)))

    prose = described_class.new
    feed_all(prose, [ proposal_reply("stage one", "Here is the JSON you asked for:\n#{JSON.generate(json)}\nHope this helps!") ])
    expect(prose.finish[:proposal]).to eq(JSON.parse(JSON.generate(json)))

    # The second LIVE failure shape (2026-11-10): an unescaped ASCII quote
    # INSIDE a string value — 聊"天不等于工程 — repaired by the quote walk.
    quoted = described_class.new
    feed_all(quoted, [ proposal_reply(
      "stage one",
      '{"topic":"t","stages":[{"name":"s","nodes":[{"title":"聊"天不等于工程","description":"理解传统"随意聊天"式编码的局限","optional":false}]}]}'
    ) ])
    expect(quoted.finish[:proposal]).to eq({
      "topic" => "t",
      "stages" => [ {
        "name" => "s",
        "nodes" => [ { "title" => "聊\"天不等于工程", "description" => "理解传统\"随意聊天\"式编码的局限", "optional" => false } ]
      } ]
    })

    # Structural damage the quote walk cannot bridge: a truncated document
    # and an object-syntax spill inside an array — still honest nil.
    truncated = described_class.new
    feed_all(truncated, [ proposal_reply("stage one", '{"topic":"t","stages":[{"name":"s","nodes":[{"title":"n"}]}]') ])
    expect(truncated.finish[:proposal]).to be_nil

    spilled = described_class.new
    feed_all(spilled, [ proposal_reply("stage one", '{"topic":"t","stages":["name":"s"]}') ])
    expect(spilled.finish[:proposal]).to be_nil
  end

  it "exposes the reply tail for the controller's failure log" do
    splitter = described_class.new
    feed_all(splitter, [ "<outline>x</outline>\n<proposal>{broken json</proposal>" ])
    expect(splitter.reply_tail).to include("{broken json")
  end

  it "salvages the proposal when a WRAPPER tag is missing (2026-11-10 live failure classes)" do
    json = { topic: "t", stages: [ { name: "s", nodes: [ { title: "n", description: nil, optional: false } ] } ] }

    # No </outline> at all — the outline streamed, the tags for the proposal
    # are still in the raw reply: salvage, don't fail.
    no_close = described_class.new
    feed_all(no_close, [ "<outline>\nstage one\n<proposal>\n#{JSON.generate(json)}\n</proposal>" ])
    expect(no_close.finish[:proposal]).to eq(JSON.parse(JSON.generate(json)))

    # No <outline> opener either — the reply is bare JSON: same salvage.
    bare = described_class.new
    feed_all(bare, [ JSON.generate(json) ])
    expect(bare.finish[:proposal]).to eq(JSON.parse(JSON.generate(json)))

    # No </proposal> — the reply truncates right after the JSON (the R5 live
    # shape): the open tag is the anchor, the ladder strips the absent close.
    no_close_tag = described_class.new
    feed_all(no_close_tag, [ "<outline>\nstage one\n</outline>\n<proposal>\n#{JSON.generate(json)}\n" ])
    expect(no_close_tag.finish[:proposal]).to eq(JSON.parse(JSON.generate(json)))
  end

  it "flushes a held-back tail when the close tag never arrives" do
    splitter = described_class.new
    tokens = feed_all(splitter, [ "<outline>streaming that stops early" ])
    tokens.concat(splitter.feed("more text"))
    result = splitter.finish

    # The outline (minus the held-back margin) streamed; no proposal.
    expect(tokens.join).to include("streaming that stops")
    expect(result[:proposal]).to be_nil
  end
end
