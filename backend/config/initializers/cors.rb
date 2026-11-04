# frozen_string_literal: true

# CORS (AD-16/AD-20, epic P2-5 ticket 04 — kickoff delta 2): the ONE origin
# allowlist, covering both browser-facing api surfaces — GraphQL and the SSE
# endpoint (AD-16: the SSE endpoint sits under the same allowlist as
# GraphQL). Origins read ENV at boot (AD-12 posture): CORS_ORIGIN is a
# comma-separated list; blank means NO cross-origin is allowed (Rack::Cors
# simply never answers preflights) — the safe pre-cutover default; the web
# cutover (epic P2-8) sets it to the deployed Pages origin.
#
# No credentials: the api is bearer-token (Authorization header), so cookies
# are never involved — `credentials true` would only widen the CSRF surface.
Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins(*ENV["CORS_ORIGIN"].to_s.split(",").map(&:strip).reject(&:empty?))

    resource "/graphql",
      headers: :any,
      methods: %i[post options]
    resource "/api/stream",
      headers: :any,
      methods: %i[get options]
  end
end
