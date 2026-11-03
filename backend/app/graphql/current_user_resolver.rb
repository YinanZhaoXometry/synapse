# frozen_string_literal: true

# The request-scoped current_user resolver (AD-15, epic P2-2 ticket 02).
# GraphqlController builds one per GraphQL request into the schema context
# (context[:current_user]); the auth guard
# (Mutations::BaseMutation#current_user!) is the only consumer.
#
# Lazy + memoized by design: the Authorization header is only parsed, the
# token only decoded, and the row only looked up on the first #user call —
# so public operations (register/login/health) never pay for any of it, and
# an auth-guarded request pays at most once per request no matter how many
# guarded fields/mutations it touches.
#
# Resolution contract (never raises):
# - "Authorization: Bearer <token>" (scheme case-insensitive) → the token is
#   verified with Accounts::TokenCodec.decode and the user loaded by uuid.
# - No token to speak of (absent/empty header, or a header without the
#   Bearer scheme), garbage/expired token, or a valid token whose user row
#   no longer exists (stateless — no denylist, AD-15) → #user is nil.
# - #decode_error keeps the decode taxonomy for logs (AD-9): :expired,
#   :invalid, or nil. nil covers BOTH "no decode was attempted" (anonymous
#   — no extractable token, epic P2-2 review P2-4: short-circuited to no
#   session with NO decode and NO log; the pre-review version logged
#   "[auth] bearer token invalid" for every anonymous request, drowning the
#   log in noise) and "decoded but the user row is gone"; :expired/:invalid
#   only ever appear for a PRESENT but bad token. All flavors map to the
#   same UNAUTHORIZED at the guard — the distinction reaches the log line,
#   never the response (it would leak token state to the client).
class CurrentUserResolver
  def initialize(authorization_header)
    @authorization_header = authorization_header
    @resolved = false
    @user = nil
    @decode_error = nil
  end

  # The memoized User, or nil. The entry point the auth guard uses.
  def user
    resolve_once! unless @resolved
    @user
  end

  # Why #user is nil: :expired, :invalid, or nil (resolution never ran into
  # a decode failure — either it succeeded or the user row is gone). For
  # logs only; the guard maps every flavor to UNAUTHORIZED.
  def decode_error
    resolve_once! unless @resolved
    @decode_error
  end

  private

  def resolve_once!
    @resolved = true

    token = bearer_token
    # Anonymous request: nothing extractable to decode — short-circuit to no
    # session with NO decode and NO log (P2-4). An info line here fired for
    # every unauthenticated request and carried zero signal.
    return if token.nil?

    decoded = Accounts::TokenCodec.decode(token)
    if decoded.ok?
      @user = User.find_by(id: decoded.user_uuid)
      Rails.logger.info("[auth] bearer token verified but its user no longer exists") if @user.nil?
    else
      @decode_error = decoded.error
      Rails.logger.info("[auth] bearer token #{decoded.error} — no session")
    end
  end

  def bearer_token
    match = /\ABearer\s+(?<token>.+)\z/i.match(@authorization_header.to_s)
    match[:token] if match
  end
end
