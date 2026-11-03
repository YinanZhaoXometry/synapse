# frozen_string_literal: true

# The auth guard shared by mutations (Mutations::BaseMutation) and queries
# (Types::QueryType) — epic P2-3 kickoff delta 8: every operation except
# health/register/login demands authentication → UNAUTHORIZED when
# absent/invalid/expired.
#
# The guard logic moves here verbatim from Mutations::BaseMutation (epic P2-2
# ticket 02) now that the query side needs the same seam; the wire shape is
# unchanged and stays pinned by spec/graphql/auth_guard_spec.rb.
module CurrentUserGuard
  # The auth guard (AD-15): an operation that demands authentication calls
  # this and gets the User — or an UNAUTHORIZED GraphQL error
  # (extensions.code). The error payload is built as a typed
  # ApplicationErrors::Failure and presented through the SAME epic-01
  # ErrorPresenter every command failure uses (P2-6) — payload construction
  # has one site. The resolver under context[:current_user] is lazy +
  # memoized (CurrentUserResolver, built in GraphqlController), so a request
  # only pays for token verification when an operation actually demands
  # auth — and at most once per request.
  def current_user!
    user = context[:current_user]&.user
    return user if user

    raise_execution_error_for(ApplicationErrors::Failure.new(
      code: :UNAUTHORIZED, context: { message: "authentication required" }
    ))
  end

  private

  # The single raise site: an ApplicationErrors::Failure → the
  # ErrorPresenter's payload → the GraphQL error the transport carries.
  def raise_execution_error_for(failure)
    payload = ErrorPresenter.call(failure)
    raise GraphQL::ExecutionError.new(payload[:message], extensions: payload[:extensions])
  end
end
