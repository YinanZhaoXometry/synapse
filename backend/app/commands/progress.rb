# frozen_string_literal: true

# The Progress context (AD-12): reading-progress persistence lives under
# app/commands/progress/ (one directory per context, epic-03 kickoff
# delta 4). The upsert keyed by the material IS the idempotency — a re-save
# overwrites cleanly (the Phase-1 saveReadingProgress shape); there is no
# client uuid on the op.
module Progress
end
