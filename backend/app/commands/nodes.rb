# frozen_string_literal: true

# The Nodes context (AD-12): per-node self-declared Study Mark ops (FR-47,
# epic-28) live under app/commands/nodes/. The context's one law (the ADR's,
# verbatim): a mark is a claim about where the user says they are — NEVER
# evidence; no command here touches evidence_records or Mastery (the
# mastery-vector anti-drift suite is the standing tripwire).
module Nodes
end
