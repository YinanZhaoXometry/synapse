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
  #
  # Bounded memory (epic P2-2 review, finding P2-1): the store is capped at
  # MAX_KEYS distinct emails. The shed semantics, picked and pinned: at cap,
  # a NEW (untracked) email is admitted WITHOUT being recorded — fail-open —
  # while every already-tracked email keeps its exact count and lockout.
  # Rationale: denying untracked keys would let a flood of forged emails
  # convert memory pressure into a total login outage (strictly worse than
  # best-effort throttling), and wiping the store would hand already-counted
  # attackers a fresh window. The store self-heals: the stale-window sweep
  # drops every pre-rotation bucket at each window boundary, so a flood ages
  # out and recording resumes — memory is bounded by ~MAX_KEYS small hashes,
  # never unbounded.
  #
  # The sweep is amortized: it runs once per computed window index (tracked
  # in @last_pruned_window), not once per attempt — the pre-review version
  # walked the whole store on every login attempt. All state changes sit
  # behind the mutex, so the rotation marker cannot race.
  class LoginRateLimiter
    DEFAULT_THRESHOLD = 10
    DEFAULT_WINDOW_SECONDS = 60
    # Distinct tracked emails before the shed above kicks in. 10k emails at
    # one small hash each is a few MB — orders of magnitude past any honest
    # login traffic, far short of mattering for memory.
    MAX_KEYS = 10_000

    class << self
      # One decision per attempt: records the attempt for the email's current
      # window and answers whether it may proceed. True (and recorded) while
      # the window holds fewer than `threshold` attempts; false once tripped —
      # a denied attempt is not recorded, so the lockout always ends exactly
      # at the window boundary, never extends. At the MAX_KEYS cap an
      # untracked email is also true — but unrecorded (shed semantics in the
      # class comment).
      def attempt(email, now: Time.current, threshold: threshold_from_env, window_seconds: window_from_env)
        key = Accounts.normalize_email(email)
        window = (now.to_i / window_seconds)

        mutex.synchronize do
          prune_if_window_rotated!(window)
          count = store.dig(key, window) || 0
          return false if count >= threshold

          # Shed (see the class comment): at cap an untracked email is
          # admitted but never recorded — throttling degrades to best-effort
          # under an adversarial flood instead of memory growing unbounded.
          return true if store.size >= MAX_KEYS && !store.key?(key)

          store[key] ||= {}
          store[key][window] = count + 1
          true
        end
      end

      # Test-only: wipes the in-memory store. The spec suite calls it between
      # examples (spec/support/login_rate_limiter_reset.rb); application code
      # never does — production "reset" is the window expiring.
      def reset!
        mutex.synchronize do
          @store = {}
          @last_pruned_window = nil
        end
      end

      private

      def store
        @store ||= {}
      end

      def mutex
        @mutex ||= Mutex.new
      end

      # Memory hygiene, amortized (P2-1): the full-store sweep runs at most
      # once per computed window index — every attempt after the first one
      # in a window early-returns on the rotation marker, so the cost of
      # walking the store is paid once per window, not once per attempt.
      def prune_if_window_rotated!(current_window)
        return if @last_pruned_window == current_window

        @last_pruned_window = current_window
        prune_stale_buckets!(current_window)
      end

      # The sweep itself: drop every bucket an upcoming window can no longer
      # reach (anything older than the current window), and with it every
      # email left without a live bucket — this is what makes a shed flood
      # age out and recording resume (see the cap comment).
      def prune_stale_buckets!(current_window)
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
