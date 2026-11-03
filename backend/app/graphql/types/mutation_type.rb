# frozen_string_literal: true

module Types
  # The mutation surface (AD-12: resolvers/mutations call ApplicationCommand
  # classes). register/login landed with epic P2-2 ticket 02 — the first
  # schema movement; the Plans operations land with epic P2-3 ticket 01.
  # No logout mutation by design (client-side token discard — epic-08).
  class MutationType < Types::BaseObject
    field :register, mutation: Mutations::Register
    field :login, mutation: Mutations::Login

    field :create_plan, mutation: Mutations::Plans::CreatePlan
    field :confirm_proposal, mutation: Mutations::Plans::ConfirmProposal
    field :update_plan, mutation: Mutations::Plans::UpdatePlan
    field :delete_plan, mutation: Mutations::Plans::DeletePlan
  end
end
