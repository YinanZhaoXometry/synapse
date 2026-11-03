# frozen_string_literal: true

module Types
  # A user-attached document (AD-7): metadata + parse state + the reader's
  # bounded extracted sections — the Phase-1 TS Material shape
  # (frontend/src/domain/entities.ts), verbatim where the wire is concerned.
  # NO bytes fields, ever: parsing stays client-side (AD-7), extracted text
  # lives in Postgres (AD-13), and file bytes are epic-06's
  # ActiveStorage/R2 story — this surface is text-only by design.
  class MaterialType < Types::BaseObject
    description "A user-attached document: metadata, parse state, and extracted sections (AD-7 — file bytes are never on this surface)."

    field :id, String,
          null: false,
          description: "The material's uuid. Ids are plain UUID strings — no GlobalID (AD-12)."

    field :title, String,
          null: false,
          description: "The document title."

    field :kind, String,
          null: false,
          description: "\"pdf\" or \"markdown\" (the reader's parse(file) input kinds)."

    field :size_bytes, Int,
          null: false,
          description: "The document's size in bytes, as reported by the client at attach."

    field :plan_id, String,
          null: true,
          description: "The plan the material is attached to (the FR-2 default attachment), if any."

    field :task_id, String,
          null: true,
          description: "The Study Task studying this material (the one-task-per-material back-link), if any."

    field :parse_state, String,
          null: false,
          description: "pending | parsing | parsed | failed (the Phase-1 ParseState vocabulary)."

    field :parse_failure_reason, String,
          null: true,
          description: "Why the parse failed — set only while parseState is failed (corrupt | encrypted | empty | unknown)."

    field :sections, [ Types::MaterialSectionType ],
          null: false,
          description: "The extracted sections in document order (empty until a parse succeeded — jsonb preserves the order)."

    field :created_at, Types::DateTime,
          null: false,
          description: "When the material was attached."
  end
end
