# frozen_string_literal: true

# The Accounts context namespace (AD-15): its commands live under
# app/commands/accounts/, its shared primitives (TokenCodec,
# LoginRateLimiter) under app/lib/accounts/ — this file is the namespace
# root, and it also carries the context's shared one-liner identity rule
# (epic P2-2 review, finding P2-7): the email normalization. It lives on the
# namespace rather than on User or TokenCodec because its call sites span
# the commands, a pure in-memory limiter, and the demo seed — none of which
# should need to load ActiveRecord (or know about the codec) to compare an
# identity string.
module Accounts
  # The one email normalization (epic P2-2 review, finding P2-7): every site
  # that treats an email as an account identity — the register command, the
  # login lookup, the rate limiter's key, the demo seed — funnels through
  # here. Single-sourcing is not cosmetic: the limiter's key MUST be the
  # same normalization the credential lookup uses, or a future rule change
  # (e.g. also stripping whitespace) would leave one site diverging and open
  # a throttle bypass (" Foo@x" and "Foo@x" are one account but two limiter
  # buckets). Deliberately a context function, not User.normalize_email: it
  # must stay a pure string function (the limiter is ActiveRecord-free), and
  # credential rules live context-side per epic-01's minimal-model posture.
  # Behavior contract: downcase only (v1) — tightening it changes every
  # account-identity comparison, so that moves with an epic that owns the
  # data story, not as a drive-by.
  def self.normalize_email(email)
    email.to_s.downcase
  end
end
