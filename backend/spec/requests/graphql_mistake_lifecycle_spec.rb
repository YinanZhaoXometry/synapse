# frozen_string_literal: true

require "rails_helper"

# The mistake lifecycle on the wire (epic-18 T1, spec decision 4): the owner
# marks a mistake resolved (and open again) through setMistakeEntryResolved —
# a replay-safe setter whose law lives in ::Mistakes::SetMistakeEntryResolvedCommand.
# External behavior only: what the mutation accepts/replays/refuses, and the
# `resolved` flag round-tripping on both read surfaces (mistakesHub +
# planMistakeEntries). The flag never touches evidence_records or Mastery
# (AD-6/ADR-0001 fence) — nothing in these flows goes near either.
RSpec.describe "GraphQL mistake lifecycle (epic-18 T1)", type: :request do
  let(:password) { "known-password-123" }
  let(:user) { create(:user, email: "mistake-lifer@example.com", password: password) }
  let(:token) { token_for(user.email) }

  # A plan-scoped entry (so planMistakeEntries can round-trip the flag):
  # node on a plan, question sourced from one of the plan's materials.
  let(:plan) { create(:study_plan, user: user) }
  let(:node) { create(:knowledge_node, user: user, plan: plan, title: "Mastery rules", order: 0) }
  let(:material) do
    create(:material, user: user, plan: plan, sections: [
      { "id" => "sec-1", "title" => "Scoping", "text" => "Every row is scoped by user_id." }
    ])
  end
  let(:question) { create(:question, user: user, node: node, source_material: material) }
  let(:entry) { create(:mistake_entry, user: user, question: question, node: node) }

  def resolve_mutation(id, resolved, client_uuid)
    graphql(
      "mutation { setMistakeEntryResolved(input: { clientUuid: \"#{client_uuid}\", " \
      "id: \"#{id}\", resolved: #{resolved} }) { mistakeEntry { id resolved } } }",
      token: token
    )
  end

  it "answers UNAUTHORIZED without a token" do
    result = graphql(
      "mutation { setMistakeEntryResolved(input: { clientUuid: \"#{SecureRandom.uuid}\", " \
      "id: \"#{SecureRandom.uuid}\", resolved: true }) { mistakeEntry { id } } }"
    )
    expect(error_code(result)).to eq("UNAUTHORIZED")
  end

  it "marks an open mistake resolved (wire payload + DB truth)" do
    result = resolve_mutation(entry.id, true, SecureRandom.uuid)

    payload = result.dig("data", "setMistakeEntryResolved", "mistakeEntry")
    aggregate_failures do
      expect(payload["id"]).to eq(entry.id)
      expect(payload["resolved"]).to be(true)
      expect(entry.reload.resolved).to be(true)
    end
  end

  it "un-resolves a resolved mistake (the toggle works both ways)" do
    entry.update!(resolved: true)

    result = resolve_mutation(entry.id, false, SecureRandom.uuid)

    payload = result.dig("data", "setMistakeEntryResolved", "mistakeEntry")
    aggregate_failures do
      expect(payload["resolved"]).to be(false)
      expect(entry.reload.resolved).to be(false)
    end
  end

  it "is replay-idempotent on the wire: the same clientUuid returns the same state with updated_at untouched" do
    client_uuid = SecureRandom.uuid

    first = resolve_mutation(entry.id, true, client_uuid)
    after_first_updated_at = entry.reload.updated_at # the first call legitimately writes
    replay = resolve_mutation(entry.id, true, client_uuid)

    aggregate_failures do
      expect(error_code(first)).to be_nil
      expect(error_code(replay)).to be_nil
      expect(first.dig("data", "setMistakeEntryResolved", "mistakeEntry", "resolved")).to be(true)
      expect(replay.dig("data", "setMistakeEntryResolved", "mistakeEntry", "resolved")).to be(true)
      # DB truth: the replay wrote nothing (microsecond precision — an
      # UPDATE would move it)
      expect(entry.reload.updated_at).to eq(after_first_updated_at)
    end
  end

  it "answers NOT_FOUND uniformly for an unknown, foreign, and malformed entry id" do
    foreign = create(:mistake_entry) # another user's row

    aggregate_failures do
      result = resolve_mutation(SecureRandom.uuid, true, SecureRandom.uuid)
      expect(error_code(result)).to eq("NOT_FOUND")

      result = resolve_mutation(foreign.id, true, SecureRandom.uuid)
      expect(error_code(result)).to eq("NOT_FOUND")
      expect(foreign.reload.resolved).to be(false)

      result = resolve_mutation("garbage", true, SecureRandom.uuid)
      expect(error_code(result)).to eq("NOT_FOUND")
    end
  end

  it "refuses a non-uuid clientUuid with VALIDATION_FAILED and writes nothing" do
    result = resolve_mutation(entry.id, true, "not-a-uuid")

    aggregate_failures do
      expect(error_code(result)).to eq("VALIDATION_FAILED")
      expect(entry.reload.resolved).to be(false)
    end
  end

  it "resolves a forfeited entry like any other (a forfeit is still a mistake worth reviewing)" do
    forfeited = create(:mistake_entry, user: user, question: question, node: node,
                                       user_answer: "", forfeited: true)

    result = resolve_mutation(forfeited.id, true, SecureRandom.uuid)

    payload = result.dig("data", "setMistakeEntryResolved", "mistakeEntry")
    aggregate_failures do
      expect(payload["resolved"]).to be(true)
      expect(forfeited.reload.resolved).to be(true)
      expect(forfeited.reload.forfeited).to be(true) # the forfeit flag is untouched
    end
  end

  it "scopes the toggle per user: two owners each reach only their own row" do
    other = create(:user, email: "mistake-lifer-2@example.com", password: password)
    other_entry = create(:mistake_entry, user: other)

    aggregate_failures do
      # The owner resolves their own row…
      result = resolve_mutation(entry.id, true, SecureRandom.uuid)
      expect(error_code(result)).to be_nil
      expect(entry.reload.resolved).to be(true)
      # …never the other user's (uniform NOT_FOUND — never reveals existence)…
      result = resolve_mutation(other_entry.id, true, SecureRandom.uuid)
      expect(error_code(result)).to eq("NOT_FOUND")
      expect(other_entry.reload.resolved).to be(false)
    end

    # …and the other user's hub never shows the owner's row (AD-13 read scoping).
    other_token = token_for(other.email)
    readback = graphql("query { mistakesHub { id } }", token: other_token)
    expect(readback.dig("data", "mistakesHub").map { |row| row["id"] }).to eq([ other_entry.id ])
  end

  it "round-trips resolved on both read surfaces (mistakesHub + planMistakeEntries)" do
    entry.update!(resolved: true)

    hub = graphql("query { mistakesHub { id resolved forfeited } }", token: token)
    hub_row = hub.dig("data", "mistakesHub").find { |row| row["id"] == entry.id }
    expect(hub_row["resolved"]).to be(true)

    plan_rows = graphql(
      "query { planMistakeEntries(planId: \"#{plan.id}\") { id resolved } }", token: token
    )
    plan_row = plan_rows.dig("data", "planMistakeEntries").find { |row| row["id"] == entry.id }
    expect(plan_row["resolved"]).to be(true)
  end
end
