# frozen_string_literal: true

require "rails_helper"

RSpec.describe Mistakes::SetMistakeEntryResolvedCommand do
  # The mistake-lifecycle setter (epic-18 T1, spec decision 4). Replay-before-
  # write: the setter stamps no row of its own, so the row's current state is
  # the replay answer — the entry already carrying the requested state returns
  # UNCHANGED (updated_at untouched). Addressing follows the house NOT_FOUND
  # matrix (AD-13): unknown, foreign, or malformed ids answer uniformly
  # NOT_FOUND; a non-uuid clientUuid is the delta-3 shape refusal.
  # Forfeited entries resolve like any other (spec decision 4).

  let(:user) { create(:user) }
  let(:entry) { create(:mistake_entry, user: user) }

  def call(id, resolved, client_uuid: SecureRandom.uuid)
    described_class.call(current_user: user, client_uuid: client_uuid, id: id, resolved: resolved)
  end

  it "marks an open mistake resolved and returns the row" do
    result = call(entry.id, true)

    aggregate_failures do
      expect(result.success?).to be(true)
      expect(result.value![:mistake_entry].id).to eq(entry.id)
      expect(entry.reload.resolved).to be(true)
    end
  end

  it "marks a resolved mistake open again (the toggle works both ways)" do
    entry.update!(resolved: true)

    result = call(entry.id, false)

    aggregate_failures do
      expect(result.success?).to be(true)
      expect(entry.reload.resolved).to be(false)
    end
  end

  it "resolves a forfeited entry like any other, leaving the forfeit flag alone" do
    forfeited = create(:mistake_entry, user: user, forfeited: true)

    result = call(forfeited.id, true)

    aggregate_failures do
      expect(result.success?).to be(true)
      expect(forfeited.reload.resolved).to be(true)
      expect(forfeited.reload.forfeited).to be(true)
    end
  end

  it "replays before writing: the entry already carrying the state returns with updated_at untouched" do
    entry.update!(resolved: true)
    before_updated_at = entry.reload.updated_at

    result = call(entry.id, true) # a replay of the landed toggle

    aggregate_failures do
      expect(result.success?).to be(true)
      expect(result.value![:mistake_entry].id).to eq(entry.id)
      expect(entry.reload.updated_at).to eq(before_updated_at)
    end
  end

  it "answers NOT_FOUND for an unknown id" do
    result = call(SecureRandom.uuid, true)

    aggregate_failures do
      expect(result.success?).to be(false)
      expect(result.failure.code).to eq(:NOT_FOUND)
    end
  end

  it "answers NOT_FOUND for a foreign id (another user's row — never linked, AD-13)" do
    foreign = create(:mistake_entry)

    result = call(foreign.id, true)

    aggregate_failures do
      expect(result.success?).to be(false)
      expect(result.failure.code).to eq(:NOT_FOUND)
    end
    expect(foreign.reload.resolved).to be(false)
  end

  it "answers NOT_FOUND for a malformed (non-uuid) id" do
    result = call("../../etc/passwd", true)

    aggregate_failures do
      expect(result.success?).to be(false)
      expect(result.failure.code).to eq(:NOT_FOUND)
    end
  end

  it "refuses a non-boolean resolved with VALIDATION_FAILED" do
    result = call(entry.id, "yes")

    aggregate_failures do
      expect(result.success?).to be(false)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(result.failure.context[:field]).to eq(:resolved)
    end
    expect(entry.reload.resolved).to be(false)
  end

  it "refuses a non-uuid clientUuid with VALIDATION_FAILED (the delta-3 shape refusal)" do
    result = call(entry.id, true, client_uuid: "not-a-uuid")

    aggregate_failures do
      expect(result.success?).to be(false)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(result.failure.context[:field]).to eq(:clientUuid)
    end
    expect(entry.reload.resolved).to be(false)
  end
end
