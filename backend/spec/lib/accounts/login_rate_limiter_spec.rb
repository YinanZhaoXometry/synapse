# frozen_string_literal: true

require "rails_helper"

RSpec.describe Accounts::LoginRateLimiter do
  # Every example pins its own clock and passes threshold/window explicitly
  # (or via ENV where the example is about the ENV config) — the limiter's
  # in-memory state never leaks between examples because the suite-wide hook
  # in spec/support/login_rate_limiter_reset.rb resets it before each one.
  let(:now) { Time.utc(2026, 11, 4, 12, 0, 0) }
  let(:threshold) { 3 }
  let(:window_seconds) { 60 }

  def attempt(email, at: now)
    described_class.attempt(
      email,
      now: at,
      threshold: threshold,
      window_seconds: window_seconds
    )
  end

  def with_env(key, value)
    original = ENV[key]
    ENV[key] = value
    yield
  ensure
    if original.nil?
      ENV.delete(key)
    else
      ENV[key] = original
    end
  end

  describe ".attempt — one decision per attempt (counts + admits)" do
    it "admits exactly the threshold-many attempts in one window" do
      threshold.times do |i|
        expect(attempt("burst@example.com", at: now + i.seconds)).to be(true), "attempt #{i + 1}"
      end
    end

    it "denies the attempt that would exceed the threshold" do
      threshold.times { attempt("burst@example.com") }

      expect(attempt("burst@example.com")).to be(false)
      expect(attempt("burst@example.com", at: now + 30.seconds)).to be(false)
    end

    it "admits again once the window boundary passes — deterministic, no sleeps" do
      threshold.times { attempt("burst@example.com") }
      expect(attempt("burst@example.com", at: now + window_seconds - 1.second)).to be(false)

      # A new fixed window starts at exactly now + window_seconds: the old
      # count is unreachable, the email gets a fresh allowance.
      expect(attempt("burst@example.com", at: now + window_seconds)).to be(true)
    end

    it "keys the counter on the downcased email" do
      threshold.times { attempt("BURST@EXAMPLE.COM") }

      expect(attempt("burst@example.com")).to be(false)
      expect(attempt("Burst@Example.com")).to be(false)
    end

    it "isolates emails — tripping one leaves the others untouched" do
      threshold.times { attempt("burst@example.com") }

      expect(attempt("other@example.com")).to be(true)
      expect(attempt("burst@example.com")).to be(false)
    end
  end

  describe "ENV-overridable threshold + window (AD-12 config posture)" do
    it "reads the threshold from LOGIN_RATE_LIMIT_THRESHOLD without explicit kwargs" do
      with_env("LOGIN_RATE_LIMIT_THRESHOLD", "2") do
        expect(described_class.attempt("env@example.com", now: now)).to be(true)
        expect(described_class.attempt("env@example.com", now: now)).to be(true)
        expect(described_class.attempt("env@example.com", now: now)).to be(false)
      end
    end

    it "reads the window from LOGIN_RATE_LIMIT_WINDOW_SECONDS without explicit kwargs" do
      with_env("LOGIN_RATE_LIMIT_WINDOW_SECONDS", "45") do
        expect(described_class.attempt("env-window@example.com", now: now)).to be(true)
        # Inside the 45s window: second attempt still counts the same bucket
        # (the default threshold 10 leaves plenty of room).
        expect(described_class.attempt("env-window@example.com", now: now + 44.seconds)).to be(true)
        # One second past the boundary: a fresh window.
        expect(described_class.attempt("env-window@example.com", now: now + 45.seconds)).to be(true)
      end
    end

    it "falls back to the sane defaults for garbage ENV values" do
      with_env("LOGIN_RATE_LIMIT_THRESHOLD", "not-a-number") do
        described_class::DEFAULT_THRESHOLD.times do
          expect(described_class.attempt("garbage@example.com", now: now)).to be(true)
        end
        expect(described_class.attempt("garbage@example.com", now: now)).to be(false)
      end
    end
  end

  describe ".reset! — the suite's test-only hook" do
    it "wipes the in-memory store so a tripped window stops tripping" do
      threshold.times { attempt("reset@example.com") }
      expect(attempt("reset@example.com")).to be(false)

      described_class.reset!

      expect(attempt("reset@example.com")).to be(true)
    end
  end

  # epic P2-2 review, finding P2-1: the store must not grow unbounded under
  # an attacker cycling distinct emails, and the stale-window sweep must not
  # walk the whole store on every attempt.
  describe "MAX_KEYS cap — bounded memory under an email flood" do
    it "stops recording new keys at the cap (shed) while tracked keys stay enforced" do
      stub_const("Accounts::LoginRateLimiter::MAX_KEYS", 3)

      threshold.times { attempt("tracked@example.com") } # tripped + tracked
      attempt("flood1@example.com")
      attempt("flood2@example.com")                      # the store is now at the cap: 3 keys
      expect(described_class.send(:store).size).to eq(3)

      # The flood cannot add a fourth key: every new email is admitted but
      # NEVER recorded — it stays admitted no matter how many times it
      # repeats (a recorded key would have tripped at the threshold's
      # fourth attempt).
      (threshold + 1).times do
        expect(attempt("flood3@example.com")).to be(true)
      end
      expect(described_class.send(:store).size).to eq(3)

      # Already-tracked emails are unaffected: exact counting + lockout hold.
      expect(attempt("tracked@example.com")).to be(false)
      expect(attempt("flood1@example.com", at: now + 1.second)).to be(true)
    end

    it "fails OPEN at the cap, not closed — a flood must not become a total login outage" do
      stub_const("Accounts::LoginRateLimiter::MAX_KEYS", 3)

      %w[flood1@example.com flood2@example.com flood3@example.com].each { |e| attempt(e) }

      # The honest newcomer gets in at cap (denying untracked keys would let
      # a forged-email flood convert memory pressure into a login outage).
      expect(attempt("honest@example.com")).to be(true)
    end

    it "self-heals at the window rotation — shed keys age out and recording resumes" do
      stub_const("Accounts::LoginRateLimiter::MAX_KEYS", 3)

      %w[flood1@example.com flood2@example.com flood3@example.com].each { |e| attempt(e) }
      expect(attempt("blocked-while-full@example.com")).to be(true) # shed, unrecorded

      # Past the boundary the amortized sweep drops the stale buckets, the
      # flood's keys age out, and tracking resumes for new emails.
      fresh = "after-rotation@example.com"
      threshold.times { |i| expect(attempt(fresh, at: now + window_seconds + i.seconds)).to be(true) }
      expect(attempt(fresh, at: now + window_seconds)).to be(false)
    end

    it "bounds the real default cap — a 10k-email flood neither trips honest keys nor grows past MAX_KEYS" do
      stub_const("Accounts::LoginRateLimiter::MAX_KEYS", 10_000)

      10_000.times do |i|
        expect(attempt("flood-#{i}@example.com")).to be(true)
      end
      # At cap exactly: the next distinct email is shed (admitted, unrecorded).
      expect(attempt("overflow@example.com")).to be(true)
      expect(described_class.send(:store).size).to eq(10_000)
      # A tracked email keeps counting through the flood (1 recorded so far,
      # threshold 3 here): the cap never disabled enforcement for the tracked.
      expect(attempt("flood-0@example.com")).to be(true)
      expect(attempt("flood-0@example.com")).to be(true)
      expect(attempt("flood-0@example.com")).to be(false)
    end
  end

  describe "amortized stale-window sweep (P2-1)" do
    # `prune_stale_buckets!` is the full-store walk; the rotation marker
    # guard around it is what makes it amortized. The pre-review limiter
    # walked the store on EVERY attempt — this pins the new shape.
    it "sweeps the store once per window index, not once per attempt" do
      allow(described_class).to receive(:prune_stale_buckets!).and_call_original

      (threshold * 5).times { attempt("amortized@example.com") }
      expect(described_class).to have_received(:prune_stale_buckets!).exactly(1).time

      attempt("amortized@example.com", at: now + window_seconds)
      expect(described_class).to have_received(:prune_stale_buckets!).exactly(2).times
    end
  end
end
