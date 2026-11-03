# frozen_string_literal: true

module Types
  # The contract's datetime scalar: the same ISO-8601 wire format as
  # graphql-ruby's built-in GraphQL::Types::ISO8601DateTime (coercion is
  # delegated to it), but WITHOUT its @specifiedBy(url:) directive.
  #
  # Why a house scalar at all: printing that directive's String argument is
  # what breaks the IDL dump on the pinned stack — GraphQL::Language.serialize
  # passes `quirks_mode:` to JSON.generate, which the json gem 3.x bundled
  # with Ruby 3.4 removed (the same breakage class that made this scaffold
  # dump IDL-only in the first place; the upstream fix, graphql-ruby 2.6.8's
  # PR #5699, sits outside the pinned ~> 2.5.26). A directive-less scalar
  # keeps `graphql:schema:dump` printable and the committed contract green on
  # the pinned gems. If the graphql pin ever moves past 2.6.8, the built-in
  # ISO8601DateTime could come back — that is a stack-pin change, not this
  # ticket's scope.
  class DateTime < Types::BaseScalar
    graphql_name "DateTime"
    description "An ISO-8601 encoded datetime string (RFC 3339)."

    def self.coerce_input(value, _ctx)
      GraphQL::Types::ISO8601DateTime.coerce_input(value, _ctx)
    end

    def self.coerce_result(value, _ctx)
      GraphQL::Types::ISO8601DateTime.coerce_result(value, _ctx)
    end
  end
end
