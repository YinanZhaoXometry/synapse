# frozen_string_literal: true

module Types
  # One AI-authored Markdown study note (FR-40, epic P2-12 T1; delta
  # decisions 1+4): standalone and exportable, user-scoped (AD-13), one
  # scope per row (the DB's exactly-one check). `scopeId` is the one
  # non-null scope id — the address the note grounds on (plan/node/material
  # by the scope value). `enrichment` is the structured marker array
  # (markers-only v1: the body keeps the [[enrich|…]] lines verbatim);
  # `targeting` is T2's weak-spot provenance (empty for v1).
  class NoteType < Types::BaseObject
    description "An AI-authored Markdown study note (FR-40): standalone, exportable, user-scoped. One scope per note — exactly one of plan/node/material owns it, named by scope + scopeId."

    field :id, String,
          null: false,
          description: "The note's uuid — the generateNote client uuid (delta 3's replay key). Ids are plain UUID strings — no GlobalID (AD-12)."

    field :title, String,
          null: false,
          description: "The note's title — the body's first H1, or the scope record's own name when the model omitted one."

    field :body, String,
          null: false,
          description: "The full Markdown body — exportable verbatim, enrichment markers included."

    field :scope, String,
          null: false,
          description: "\"plan\" | \"node\" | \"material\" — which record the note grounds on."

    field :scope_id, String,
          null: false,
          description: "The scope record's uuid (the one non-null scope id, matching scope)."

    field :enrichment, [ Types::NoteMarkerType ],
          null: false,
          description: "The enrichment markers as a structured array (delta decision 1 — markers-only v1), in document order. The body keeps the [[enrich|…]] lines verbatim."

    field :targeting, GraphQL::Types::JSON,
          null: false,
          description: "The weak-spot targeting provenance (FR-22 lands with T2) — an empty array in v1."

    field :created_at, Types::DateTime,
          null: false,
          description: "When the note was generated."

    def scope_id
      object.plan_id || object.node_id || object.material_id
    end
  end
end
