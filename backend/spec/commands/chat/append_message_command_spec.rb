# frozen_string_literal: true

require "rails_helper"

RSpec.describe Chat::AppendMessageCommand do
  # The Companion transcript write — the Phase-1 progress-repository
  # appendChatMessage mirror (frontend/src/data/progress-repository.ts): the
  # thread is 1:1 with its material (unique index) and is created on first
  # append, the message embeds as a jsonb row with server-minted id/createdAt
  # (the Phase-1 client clock never reaches a row), and citations round-trip
  # as ReadingLocator jsonb (AD-2, TS keys verbatim). No client uuid exists
  # on the Phase-1 op — every call appends exactly one message (not
  # replay-idempotent, the recordEvidence posture; pinned below).

  let(:user) { create(:user) }
  let(:material) { create(:material, user: user) }

  # material_id is a top-level override; everything else rides the message.
  def call(overrides = {})
    described_class.call(
      current_user: user,
      material_id: overrides.fetch(:material_id, material.id),
      message: {
        role: "user",
        text: "Explain section 2 again.",
        citations: []
      }.merge(overrides.except(:material_id))
    )
  end

  describe ".call" do
    it "creates the thread on first append and embeds the message with a server-minted id and createdAt" do
      result = call

      expect(result.success?).to be(true)
      message = result.value![:message]
      thread = user.chat_threads.find_by!(material_id: material.id)
      expect(thread.messages.length).to eq(1)

      row = thread.messages.first
      expect(row["role"]).to eq("user")
      expect(row["text"]).to eq("Explain section 2 again.")
      expect(row["citations"]).to eq([])
      expect(row["id"]).to match(Accounts::UUID_REGEX)
      expect(Time.zone.parse(row["createdAt"])).to be_within(1.minute).of(Time.current)

      expect(message["id"]).to eq(row["id"])
      expect(user.chat_threads.count).to eq(1)
    end

    it "appends to the existing thread on the next message (one thread per material, order preserved)" do
      call(text: "first")
      result = call(role: "companion", text: "second")

      thread = user.chat_threads.find_by!(material_id: material.id)
      expect(user.chat_threads.count).to eq(1)
      expect(thread.messages.map { |row| row["text"] }).to eq([ "first", "second" ])
      expect(thread.messages.last["role"]).to eq("companion")
      expect(result.value![:message]["text"]).to eq("second")
    end

    it "moves the thread's updated_at with each append" do
      call
      thread = user.chat_threads.find_by!(material_id: material.id)
      first_updated_at = thread.updated_at

      call

      expect(thread.reload.updated_at).to be > first_updated_at
    end

    it "round-trips citations as ReadingLocator jsonb with TS keys verbatim (delta 7)" do
      result = call(citations: [
        { kind: "markdown", section_id: "sec-2" },
        { kind: "pdf", page: 3 }
      ])

      thread = user.chat_threads.find_by!(material_id: material.id)
      expect(thread.messages.first["citations"]).to eq([
        { "kind" => "markdown", "sectionId" => "sec-2" },
        { "kind" => "pdf", "page" => 3 }
      ])
      expect(result.value![:message]["citations"]).to eq(thread.messages.first["citations"])
    end

    it "normalizes kind-irrelevant locator keys away (the CreateSessionCommand choice-shape mirror)" do
      call(citations: [
        { kind: "markdown", section_id: "sec-1", page: 9 },
        { kind: "pdf", page: 4, section_id: "sec-9" }
      ])

      thread = user.chat_threads.find_by!(material_id: material.id)
      expect(thread.messages.first["citations"]).to eq([
        { "kind" => "markdown", "sectionId" => "sec-1" },
        { "kind" => "pdf", "page" => 4 }
      ])
    end

    it "is NOT replay-idempotent — no client uuid exists on the Phase-1 op, so a re-call appends again" do
      2.times { call }

      thread = user.chat_threads.find_by!(material_id: material.id)
      expect(thread.messages.length).to eq(2)
    end

    it "fails VALIDATION_FAILED for a role outside user|companion" do
      result = call(role: "assistant")

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(user.chat_threads.count).to eq(0)
    end

    it "fails VALIDATION_FAILED for blank message text" do
      result = call(text: "   ")

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(user.chat_threads.count).to eq(0)
    end

    it "fails VALIDATION_FAILED for a malformed citation locator" do
      aggregate_failures do
        bad_kind = call(citations: [ { kind: "epub", section_id: "sec-1" } ])
        expect(bad_kind.failure?).to be(true)
        expect(bad_kind.failure.code).to eq(:VALIDATION_FAILED)

        markdown_without_section = call(citations: [ { kind: "markdown" } ])
        expect(markdown_without_section.failure?).to be(true)
        expect(markdown_without_section.failure.code).to eq(:VALIDATION_FAILED)

        pdf_without_page = call(citations: [ { kind: "pdf" } ])
        expect(pdf_without_page.failure?).to be(true)
        expect(pdf_without_page.failure.code).to eq(:VALIDATION_FAILED)

        zero_page = call(citations: [ { kind: "pdf", page: 0 } ])
        expect(zero_page.failure?).to be(true)
        expect(zero_page.failure.code).to eq(:VALIDATION_FAILED)
      end
      expect(user.chat_threads.count).to eq(0)
    end

    it "answers NOT_FOUND for a foreign, unknown, or malformed material id (delta 2) and writes nothing" do
      aggregate_failures do
        foreign = call(material_id: create(:material, user: create(:user)).id)
        expect(foreign.failure?).to be(true)
        expect(foreign.failure.code).to eq(:NOT_FOUND)

        unknown = call(material_id: SecureRandom.uuid)
        expect(unknown.failure?).to be(true)
        expect(unknown.failure.code).to eq(:NOT_FOUND)

        malformed = call(material_id: "garbage")
        expect(malformed.failure?).to be(true)
        expect(malformed.failure.code).to eq(:NOT_FOUND)
      end
      expect(user.chat_threads.count).to eq(0)
    end
  end
end
