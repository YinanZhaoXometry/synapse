# frozen_string_literal: true

module Types
  # The mutation surface (AD-12: resolvers/mutations call ApplicationCommand
  # classes). register/login landed with epic P2-2 ticket 02 — the first
  # schema movement; later epics own their operations. No logout mutation by
  # design (client-side token discard — epic-08).
  class MutationType < Types::BaseObject
    field :register, mutation: Mutations::Register
    field :login, mutation: Mutations::Login
  end
end
