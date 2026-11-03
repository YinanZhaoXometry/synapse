# frozen_string_literal: true

module Mutations
  class BaseMutation < GraphQL::Schema::RelayClassicMutation
    argument_class Types::BaseArgument
    field_class Types::BaseField
    input_object_class Types::BaseInputObject
    object_class Types::BaseObject

    # The auth guard (AD-15, epic P2-2 ticket 02; per-op enforcement started
    # with epic-03's operations — delta 8 of that kickoff). It moved verbatim
    # to CurrentUserGuard when the query side needed the same seam; the wire
    # shape is unchanged and stays pinned by spec/graphql/auth_guard_spec.rb.
    include CurrentUserGuard

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
  end
end
