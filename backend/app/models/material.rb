# frozen_string_literal: true

# A user-attached document: metadata + extracted sections only (AD-7 — bytes
# go to ActiveStorage/R2 in the storage epic, no blob columns). plan_id
# realizes the StudyPlan ↔ Material attachment (the M2M is plan-side; no join
# table); task_id mirrors the one task studying this material. The attachment
# scope (FR-44, epic P2-10 T2) realizes node pinning: "plan" (default — the
# material feeds the whole plan's generation surfaces) or "node" (the
# material feeds ONLY its pinned node's surfaces — nullable node_id).
class Material < ApplicationRecord
  belongs_to :user
  belongs_to :plan, class_name: "StudyPlan", optional: true
  belongs_to :task, class_name: "StudyTask", optional: true
  # The pinned plan node when attachment_scope is "node" (nullable otherwise).
  belongs_to :node, class_name: "KnowledgeNode", optional: true

  # The original document's bytes (AD-13, epic P2-6 ticket 02): the ActiveStorage
  # attachment minted server-side at presign time (Storage::
  # CreateMaterialUploadCommand) — metadata stays on this row, bytes live in
  # R2/minio behind the blob. Downloads presign per request via the
  # Material.downloadUrl GraphQL field; no bytes ever pass through the api.
  has_one_attached :original

  has_many :flashcards
  has_one :chat_thread
  has_one :reading_progress
  has_many :section_markings
  has_many :annotations

  # Closed vocabularies pinned twice: enums here (model seam) + check
  # constraints in the migration (database floor). scopes: false — several
  # values (`open`, `empty`, `pending`) would collide with Ruby/Kernel names.
  enum :kind, { pdf: "pdf", markdown: "markdown" }, scopes: false
  enum :parse_state, { pending: "pending", parsing: "parsing", parsed: "parsed", failed: "failed" },
       default: :pending, scopes: false
  enum :parse_failure_reason, { corrupt: "corrupt", encrypted: "encrypted", empty: "empty", unknown: "unknown" },
       scopes: false
  enum :attachment_scope, { plan: "plan", node: "node" }, default: :plan, scopes: false
  # The origin axis (epic-36 T1, spec decision 1): "uploaded" (the user's own
  # document — the default, no backfill) vs "generated" (an AI 讲义, a lesson
  # the engine created server-side — no blob is legal for it). Generated
  # materials are excluded from every generation source pool and from
  # Auto-mapping (spec decision 8; GLOSSARY §Generated study content).
  enum :origin, { uploaded: "uploaded", generated: "generated" }, default: :uploaded, scopes: false
end
