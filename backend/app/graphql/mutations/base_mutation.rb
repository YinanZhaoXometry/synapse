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

      payload = ErrorPresenter.call(result.failure)
      raise GraphQL::ExecutionError.new(payload[:message], extensions: payload[:extensions])
    end

    # The auth guard (AD-15, epic P2-2 ticket 02): an operation that demands
    # authentication calls this and gets the User — or an UNAUTHORIZED
    # GraphQL error (extensions.code). The resolver under
    # context[:current_user] is lazy + memoized (CurrentUserResolver, built
    # in GraphqlController), so a request only pays for token verification
    # when an operation actually demands auth — and at most once per request.
    # Per-op enforcement starts with epic-03's operations; register/login/
    # health stay public.
    def current_user!
      user = context[:current_user]&.user
      return user if user

      raise GraphQL::ExecutionError.new(
        "authentication required",
        extensions: { code: "UNAUTHORIZED" }
      )
    end
  end
end
