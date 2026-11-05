# frozen_string_literal: true

# The annotation render surface (FR-16, epic-13 T3, delta decision 3):
# `kind` (highlight | underline — the DB default "highlight" keeps the
# epic-01 rows pure highlights), `color` (nullable — a named palette key,
# the reader's vocabulary), and `range` (nullable jsonb — the AD-2 domain
# range {sectionId?|page?, start, end, quote}: char offsets within the
# anchor text + the quoted span for drift verification). Columns only — no
# new FKs (user_id/material_id exist) — so the kind CHECK rides this
# migration NOT VALID and validates in the follow-up (the strong_migrations
# two-step). Shape discipline (offsets, quote presence, sectionId/page xor)
# is the command layer's law, not the DB's — jsonb stores as-is.
class ExtendAnnotationsForFr16 < ActiveRecord::Migration[8.1]
  def change
    add_column :annotations, :kind, :string, null: false, default: "highlight"
    add_column :annotations, :color, :string
    add_column :annotations, :range, :jsonb

    add_check_constraint :annotations, "kind IN ('highlight', 'underline')",
                         name: "annotations_kind_check", validate: false
  end
end
