# frozen_string_literal: true

# The Today hub's manual tasks (epic P2-09 T1, delta decision 4): the user's
# own additions to the 今日学习 daily list (FR-27) — T1 delivers the table +
# the read model; the add/toggle operations are T3's. due_date is a plain
# date (nullable — the unscheduled "someday" task); done is the completion
# toggle's target (boolean, no timestamp — no honest day-scoping of "done"
# exists at this layer, recorded in the ticket's ## Comments).
class CreateManualTasks < ActiveRecord::Migration[8.1]
  def change
    create_table :manual_tasks, id: :uuid, default: "gen_random_uuid()" do |t|
      t.references :user, type: :uuid, null: false, index: true
      t.text :title, null: false
      t.date :due_date
      t.boolean :done, null: false, default: false

      t.timestamps
    end

    add_foreign_key :manual_tasks, :users, validate: false
  end
end
