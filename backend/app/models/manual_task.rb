# frozen_string_literal: true

# The user's own Today-list addition (FR-27, epic P2-09 T1 — delta decision
# 4): T1 owns the table + the read model exposure; the add/toggle operations
# land with T3. due_date nullable (unscheduled), done the completion flag.
class ManualTask < ApplicationRecord
  belongs_to :user
end
