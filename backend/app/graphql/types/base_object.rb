# frozen_string_literal: true

module Types
  class BaseObject < GraphQL::Schema::Object
    # No edge/connection types here — Relay wiring comes back only when a
    # list actually paginates (AD-12).
    field_class Types::BaseField
  end
end
