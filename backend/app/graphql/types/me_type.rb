# frozen_string_literal: true

module Types
  # The session identity read (epic-25 T3, epic decision 4): the chrome's
  # minimal identity — email ONLY, deliberately not the UserType (whose
  # id/createdAt serve the register/login payloads, not the chrome) and no
  # profile entity. The web derives its display name + avatar letter from
  # the email's local-part client-side; nothing else exists to select.
  class MeType < Types::BaseObject
    description "The authenticated session's identity (epic-25 T3): the account email the chrome derives its display name and avatar letter from. Deliberately minimal — email only (epic-25 decision 4), no profile entity."

    field :email, String,
          null: false,
          description: "The session account's email (downcased at registration)."
  end
end
