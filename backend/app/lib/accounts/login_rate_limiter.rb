# frozen_string_literal: true

module Accounts
  # Login rate limiting (AD-15, epic P2-2 ticket 02): a fixed-window attempt
  # counter keyed by the normalized (downcased) email. Storage is api-local
  # memory — no Redis/external service (A2, AD-19 posture) — so the counter
  # lives and dies with the process (a restart clears it; accepted v1).
  #
  # Lives under app/lib/, not app/commands/: it is not a use case, and the
  # contract keeps that tree for ApplicationCommand subclasses — it is the
  # Accounts context's shared primitive, the sibling of Accounts::TokenCodec.
  #
  # Invocation point: Accounts::LoginUserCommand calls .attempt BEFORE any
  # credential verification — a tripped window is Failure(:RATE_LIMITED)
  # without ever touching bcrypt (login only, v1; register is not limited).
  # Command-level keeps mutations thin (AD-12) and gives every transport the
  # same protection.
  #
  # Determinism: the clock is injectable (`now:`), and the threshold/window
  # are explicit params — specs never sleep. Defaults read ENV at call time
  # (AD-12 config posture, no settings gem) with sane dev fallbacks; garbage
  # ENV values fall back to the defaults instead of locking everyone out.
  class LoginRateLimiter
    DEFAULT_THRESHOLD = 10
    DEFAULT_WINDOW_SECONDS = 60

    class << self
      # One decision per attempt: records the attempt for the email's current
      # window and answers whether it may proceed. True (and recorded) while
      # the window holds fewer than `threshold` attempts; false once tripped —
      # a denied attempt is not recorded, so the lockout always ends exactly
      # at the window boundary, never extends.
      def attempt(email, now: Time.current, threshold: threshold_from_env, window_seconds: window_from_env)
        key = email.to_s.downcase
        window = (now.to_i / window_seconds)

        mutex.synchronize do
          prune!(window)
          count = store.dig(key, window) || 0
          return false if count >= threshold

          store[key] ||= {}
          store[key][window] = count + 1
          true
        end
      end

      # Test-only: wipes the in-memory store. The spec suite calls it between
      # examples (spec/support/login_rate_limiter_reset.rb); application code
      # never does — production "reset" is the window expiring.
      def reset!
        mutex.synchronize { @store = {} }
      end

      private

      def store
        @store ||= {}
      end

      def mutex
        @mutex ||= Mutex.new
      end

      # Memory hygiene: drop every bucket an upcoming window can no longer
      # reach (anything older than the current window).
      def prune!(current_window)
        store.each_value { |windows| windows.delete_if { |window, _| window < current_window } }
        store.delete_if { |_key, windows| windows.empty? }
      end

      def threshold_from_env
        positive_int(ENV["LOGIN_RATE_LIMIT_THRESHOLD"]) || DEFAULT_THRESHOLD
      end

      def window_from_env
        positive_int(ENV["LOGIN_RATE_LIMIT_WINDOW_SECONDS"]) || DEFAULT_WINDOW_SECONDS
      end

      def positive_int(raw)
        value = raw.to_s.strip.to_i
        value if value.positive?
      end
    end
  end
end
