# frozen_string_literal: true

# The epic P2-3 review (P2-3): generation-order read-back rested on
# order(:created_at, :id), whose uuid tie-break is not insertion order — a
# latent flake in the walk/request specs that pin exact order. position is
# the ER's generation-order field: CreateSessionCommand stamps it per input
# index, and the read-backs order (position, created_at, id).
class AddPositionToQuestions < ActiveRecord::Migration[8.1]
  def up
    add_column :questions, :position, :integer

    # Backfill by the (created_at, id) sequence per session — the exact order
    # the wire has pinned so far, so existing rows keep their read order.
    # (strong_migrations cannot inspect execute; the single UPDATE is the
    # backfill-then-constrain pattern it asks for.)
    safety_assured do
      execute <<~SQL
        UPDATE questions
        SET position = ranked.rn
        FROM (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY created_at, id) AS rn
          FROM questions
        ) ranked
        WHERE questions.id = ranked.id
      SQL
    end

    # NOT NULL is safe: the backfill above populated every row before this
    # runs (strong_migrations rightly refuses a bare change_column_null —
    # this is the backfill-then-constrain pattern it asks for).
    safety_assured { change_column_null :questions, :position, false }
  end

  def down
    remove_column :questions, :position
  end
end
