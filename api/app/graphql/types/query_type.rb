# frozen_string_literal: true

module Types
  class QueryType < Types::BaseObject
    # The scaffold's single sanctioned query (epic-00 T02). Domain queries and
    # mutations land with the epics that own them (AD-12 command core).
    field :health, String, null: false,
      description: "Liveness probe: the api is up and answering queries."

    def health
      "ok"
    end
  end
end
