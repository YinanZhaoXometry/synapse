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
end
