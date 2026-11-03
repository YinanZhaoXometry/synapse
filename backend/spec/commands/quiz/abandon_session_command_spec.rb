# frozen_string_literal: true

require "rails_helper"

RSpec.describe Quiz::AbandonSessionCommand do
  # The exit path mirror (FR-18 story 15): an ACTIVE session becomes
  # `abandoned` — terminal, not resumable, NO evidence written.

  let(:user) { create(:user) }
  let(:session) { create(:quiz_session, user: user) }

  def call(overrides = {})
    described_class.call(current_user: user, session_id: session.id, **overrides)
  end

  describe ".call" do
    it "marks an active session abandoned and writes no evidence" do
      result = call

      expect(result.success?).to be(true)
      expect(result.value![:session].status).to eq("abandoned")
      expect(result.value![:session].completed_at).to be_nil
      expect(session.reload.status).to eq("abandoned")
      expect(user.evidence_records.count).to eq(0)
    end

    it "never demotes a completed session (already terminal — the Phase-1 guard)" do
      session.update!(status: "completed", completed_at: Time.current)

      result = call

      expect(result.success?).to be(true)
      expect(session.reload.status).to eq("completed")
    end

    it "is idempotent: abandoning an abandoned session succeeds without change" do
      call
      replay = call

      expect(replay.success?).to be(true)
      expect(session.reload.status).to eq("abandoned")
    end

    it "answers NOT_FOUND for a foreign, unknown, or malformed session id (delta 2)" do
      aggregate_failures do
        foreign = call(session_id: create(:quiz_session, user: create(:user)).id)
        expect(foreign.failure?).to be(true)
        expect(foreign.failure.code).to eq(:NOT_FOUND)

        unknown = call(session_id: SecureRandom.uuid)
        expect(unknown.failure?).to be(true)
        expect(unknown.failure.code).to eq(:NOT_FOUND)

        malformed = call(session_id: "garbage")
        expect(malformed.failure?).to be(true)
        expect(malformed.failure.code).to eq(:NOT_FOUND)
      end
      expect(session.reload.status).to eq("active")
    end
  end
end
