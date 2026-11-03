# frozen_string_literal: true

module Types
  # Empty for now — mutations land with the epics that own their commands
  # (AD-12: resolvers/mutations call ApplicationCommand classes).
  class MutationType < Types::BaseObject
  end
end
