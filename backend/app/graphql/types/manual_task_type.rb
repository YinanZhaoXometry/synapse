# frozen_string_literal: true

module Types
  # The user's own Today-list task (FR-27, epic P2-09 T1 — delta decision 4).
  # T1 exposes the read only; the add/toggle operations are T3's (the table
  # + read model land here, the OPS land with the surface that owns them).
  class ManualTaskType < Types::BaseObject
    description "A manual task the user added to the 今日学习 list (FR-27) — read-only in this ticket; the add/toggle operations land with the Today hub surface."

    field :id, String,
          null: false,
          description: "The manual task's uuid. Ids are plain UUID strings — no GlobalID (AD-12)."

    field :title, String,
          null: false,
          description: "What the user wrote."

    field :due_date, Types::DateTime,
          null: true,
          description: "The task's target day (null for an unscheduled 'someday' task)."

    field :done, Boolean,
          null: false,
          description: "The completion toggle's flag (no timestamp — an honest day-scoping of 'done' does not exist at this layer)."

    field :created_at, Types::DateTime,
          null: false,
          description: "When the task was added."

    field :updated_at, Types::DateTime,
          null: false,
          description: "When the task was last changed."

    # A date column serializes through the DateTime scalar at zone-local
    # midnight (the app zone is UTC) — the day itself is the fact.
    def due_date
      object.due_date&.to_time
    end
  end
end
