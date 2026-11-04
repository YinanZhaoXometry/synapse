# frozen_string_literal: true

module Types
  # One material of an imported Phase-1 document (epic P2-8 ticket 03;
  # AD-4) — metadata, sections, parse state, WITHOUT file bytes: the import
  # carries no blobs, and the re-attach invite (epic-06 presign matched by
  # id) restores them. taskId must name a task of the same document.
  class ImportedMaterialInput < Types::BaseInputObject
    description "One material of a document being imported (Phase-1 Material) — metadata only, no bytes."

    argument :id, String,
             required: true,
             description: "The material's client uuid (AD-12) — also the re-attach matching key."

    argument :title, String,
             required: true,
             description: "The document title."

    argument :kind, String,
             required: true,
             description: "\"pdf\" or \"markdown\" (the Phase-1 Material kinds)."

    argument :size_bytes, Int,
             required: false,
             description: "The document's size in bytes as the client recorded it. Advisory on the import — no bytes arrive to pin it against."

    argument :plan_id, String,
             required: false,
             description: "The attached plan's uuid (the FR-2 default attachment)."

    argument :task_id, String,
             required: false,
             description: "The studying task's uuid — must name a task of the same document."

    argument :parse_state, String,
             required: false,
             description: "pending | parsing | parsed | failed. Defaults per Phase-1: \"parsed\" when sections exist, \"pending\" otherwise."

    argument :parse_failure_reason, String,
             required: false,
             description: "corrupt | encrypted | empty | unknown — only while parseState is failed."

    argument :sections, [ Types::MaterialSectionInput ],
             required: false,
             description: "The client-extracted sections (Phase-1 MaterialSection[])."

    argument :created_at, Types::DateTime,
             required: false,
             description: "When the material was attached on the client."
  end
end
