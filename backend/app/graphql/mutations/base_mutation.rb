# frozen_string_literal: true

module Mutations
  class BaseMutation < GraphQL::Schema::RelayClassicMutation
    argument_class Types::BaseArgument
    field_class Types::BaseField
    input_object_class Types::BaseInputObject
    object_class Types::BaseObject

    private

    # Map an ApplicationCommand Result onto the mutation's payload (AD-12):
    # Success → the unwrapped value (the payload hash); Failure → a GraphQL
    # error carrying the closed-enum code, shaped by the epic-01
    # ErrorPresenter ({ message:, extensions: { code: } }). The api is not
    # user-facing (AD-9): the message is an English log line; the web maps
    # extensions.code, never the string.
    def command_result(result)
      return result.value! if result.success?

      raise_execution_error_for(result.failure)
    end

    # The auth guard (AD-15, epic P2-2 ticket 02): an operation that demands
    # authentication calls this and gets the User — or an UNAUTHORIZED
    # GraphQL error (extensions.code). The error payload is built as a typed
    # ApplicationErrors::Failure and presented through the SAME epic-01
    # ErrorPresenter every command failure uses (P2-6) — payload
    # construction has one site; the wire shape is unchanged
    # ({ message: "authentication required", extensions.code: UNAUTHORIZED },
    # pinned by spec/graphql/auth_guard_spec.rb). The resolver under
    # context[:current_user] is lazy + memoized (CurrentUserResolver, built
    # in GraphqlController), so a request only pays for token verification
    # when an operation actually demands auth — and at most once per request.
    # Per-op enforcement starts with epic-03's operations; register/login/
    # health stay public.
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
end
