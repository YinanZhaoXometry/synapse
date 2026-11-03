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
end
