# frozen_string_literal: true

require "rails_helper"

# Ai::ResponseParser (ticket 03): the string-aware balanced-brace JSON
# extraction — models wrap JSON in prose and fences despite the prompt.
RSpec.describe Ai::ResponseParser do
  describe ".extract_json_object" do
    it "extracts a clean JSON object" do
      expect(described_class.extract_json_object('{"a":1}')).to eq('{"a":1}')
    end

    it "extracts through prose and code fences" do
      raw = <<~RAW
        Here is the requested JSON:
        ```json
        {"questions":[{"prompt":"为什么","explanation":"因为"}]}
        ```
        Hope this helps!
      RAW
      extracted = described_class.extract_json_object(raw)
      expect(JSON.parse(extracted)["questions"]).to be_an(Array)
      expect(JSON.parse(extracted)["questions"].first["prompt"]).to eq("为什么")
    end

    it "ignores braces inside string literals" do
      raw = 'The answer {"text":"a brace } inside a string","n":2} is above.'
      extracted = described_class.extract_json_object(raw)
      expect(JSON.parse(extracted)).to include("text" => "a brace } inside a string", "n" => 2)
    end

    it "returns the FIRST object when several appear" do
      raw = '{"first":true} then {"second":true}'
      expect(JSON.parse(described_class.extract_json_object(raw))).to include("first" => true)
    end

    it "returns nil for no object, an unterminated object, and non-JSON content" do
      expect(described_class.extract_json_object("no braces here")).to be_nil
      expect(described_class.extract_json_object('{"unterminated": ')).to be_nil
      expect(described_class.extract_json_object("{not json}")).to be_nil
      expect(described_class.extract_json_object(nil)).to be_nil
    end
  end

  # epic-34 T1's repair layer: when the balanced scan yields no parseable
  # object, truncated-tail completion (close the open string / braces) and
  # trailing-comma removal get one chance before nil. Repair is a last
  # resort — a clean extraction is returned untouched, and a reply no
  # candidate can parse stays nil (never invented content).
  describe "repair layer (epic-34 T1)" do
    it "completes a truncated tail by closing the open string and braces" do
      extracted = described_class.extract_json_object('好的，以下是题目： {"questions":[{"prompt":"为什么"')
      expect(JSON.parse(extracted)).to eq("questions" => [ { "prompt" => "为什么" } ])
    end

    it "completes a truncated nested array" do
      expect(JSON.parse(described_class.extract_json_object('{"a":[1,2'))).to eq("a" => [ 1, 2 ])
    end

    it "completes a string left open on an escaped trailing backslash (the bytes stay)" do
      expect(JSON.parse(described_class.extract_json_object('{"a":"esc\\'))).to eq("a" => "esc\\")
    end

    it "removes a trailing comma before a closer" do
      expect(JSON.parse(described_class.extract_json_object('{"a":1,}'))).to eq("a" => 1)
    end

    it "combines tail completion with trailing-comma removal" do
      expect(JSON.parse(described_class.extract_json_object('{"a":[1,2,'))).to eq("a" => [ 1, 2 ])
      expect(JSON.parse(described_class.extract_json_object('{"a":1,'))).to eq("a" => 1)
    end

    it "keeps commas inside string literals during repair" do
      expect(JSON.parse(described_class.extract_json_object('{"a":"x,'))).to eq("a" => "x,")
    end

    it "passes a clean reply through untouched — repair never fires on a valid extraction" do
      raw = 'prefix {"a":"值,}尾巴"} suffix'
      expect(described_class.extract_json_object(raw)).to eq('{"a":"值,}尾巴"}')
    end

    it "returns nil when no repair candidate parses — the first object's failure is final" do
      expect(described_class.extract_json_object('{"a": ')).to be_nil
      expect(described_class.extract_json_object("{not json}")).to be_nil
      expect(described_class.extract_json_object('{"first":} then {"second":true}')).to be_nil
    end
  end
end
