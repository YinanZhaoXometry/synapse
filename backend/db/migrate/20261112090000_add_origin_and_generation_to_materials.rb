# frozen_string_literal: true

# Generated lessons (epic-36 T1, spec decisions 1+2+4): materials gain the
# origin axis (`uploaded` | `generated` — a lesson IS a Material, GLOSSARY
# §Generated study content) and the generation jsonb — the reader's live
# generation state, driven ONLY by it (parse_state stays the client file-parse
# axis; a lesson is always `parsed`). The stream-ticket op vocabulary gains
# `lesson` in the same change: the STREAM_OPS constant and the DB check
# constraint move together (the frozen ticket contract, AD-16).
#
# Plain additive migration, no backfill: every existing row is uploaded by
# default (generated materials did not exist before this epic), and
# generation stays null for them (only origin=generated rows carry it).
# Check constraints ride the strong_migrations two-step (the
# 20261105130000 extend_stream_tickets_op_check precedent): add unvalidated
# here, validate in the follow-up migration.
class AddOriginAndGenerationToMaterials < ActiveRecord::Migration[8.1]
  def change
    add_column :materials, :origin, :string, default: "uploaded", null: false
    add_column :materials, :generation, :jsonb

    add_check_constraint :materials, "origin IN ('uploaded', 'generated')",
                         name: "materials_origin_check", validate: false

    remove_check_constraint :stream_tickets, name: "stream_tickets_op_check"
    add_check_constraint :stream_tickets, "op IN ('companion', 'proposal', 'plan_companion', 'lesson')",
                         name: "stream_tickets_op_check", validate: false
  end
end
