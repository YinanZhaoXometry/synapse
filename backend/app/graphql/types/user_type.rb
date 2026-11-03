# frozen_string_literal: true

module Types
  # The account holder (AD-15), as the cross-stack contract exposes it
  # (schema.graphql — AD-17). Minimal on purpose: only what a client needs to
  # render identity after register/login.
  #
  # NEVER expose password_digest or any other credential material on this
  # type — it would leak into the committed contract.
  class UserType < Types::BaseObject
    description "A registered account (AD-15)."

    field :id, String,
          null: false,
          description: "The user's uuid. Ids are plain UUID strings — no GlobalID (AD-12)."

    field :email, String,
          null: false,
          description: "The account email (downcased at registration)."

    field :created_at, Types::DateTime,
          null: false,
          description: "When the account was created."
  end
end
