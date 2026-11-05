# frozen_string_literal: true

module Ai
  # The per-user daily cost cap (AD-16/FR-34/NFR-4, epic P2-5 ticket 02):
  # 50 AI calls per user per UTC day (assumption A1 — midnight-UTC boundary,
  # the streak convention), enforced INSIDE the Ai::Provider seam at the
  # adapter boundary — every provider call counts, including a stream
  # restart after a drop (deliberate double-count, AD-16; restarts are
  # client-driven, so a runaway client can never outspend the cap).
  #
  # Storage is the api-local ai_usage_counters table on the same Postgres
  # (A1), one row per user per day. `consume!` is a single atomic
  # INSERT … ON CONFLICT … RETURNING — check and increment happen together,
  # so concurrent calls cannot slip past the limit. The 50th call is
  # admitted (count 50 ≤ limit); the 51st is refused — and still counted,
  # so the refusal is monotonic within the day.
  #
  # The limit reads ENV at call time (AD-12 posture, no settings gem) with
  # sane dev fallbacks; garbage values fall back to the default.
  class DailyCap
    DEFAULT_DAILY_CALLS = 50

    class << self
      def limit
        positive_int(ENV["AI_DAILY_CALL_CAP"]) || DEFAULT_DAILY_CALLS
      end

      # Atomically increments the user's counter for `now`'s UTC day and
      # returns the new count. Pair with `.tripped?` at the seam: tripped?
      # (consume!) means refuse before touching the adapter.
      def consume!(user, now: Time.current)
        day = now.utc.to_date
        sql = <<~SQL
          INSERT INTO ai_usage_counters (id, user_id, day, call_count, created_at, updated_at)
          VALUES (gen_random_uuid(), :user_id, :day, 1, NOW(), NOW())
          ON CONFLICT (user_id, day)
          DO UPDATE SET call_count = ai_usage_counters.call_count + 1, updated_at = NOW()
          RETURNING call_count
        SQL
        sanitized = ActiveRecord::Base.sanitize_sql_array([ sql, { user_id: user.id, day: day } ])
        AiUsageCounter.connection.exec_query(sanitized).first["call_count"].to_i
      end

      def tripped?(count, limit: self.limit)
        count > limit
      end

      # The read half (epic-14 T1, FR-34's display consequence): today's
      # count for the user — the same midnight-UTC day key consume! writes,
      # read from the one counter row (absent row = zero spent). The count
      # is server truth; the Settings display renders it, never recomputes.
      def count_for(user, now: Time.current)
        counter = AiUsageCounter.find_by(user_id: user.id, day: now.utc.to_date)
        counter ? counter.call_count : 0
      end

      private

      def positive_int(raw)
        value = raw.to_s.strip.to_i
        value if value.positive?
      end
    end
  end
end
