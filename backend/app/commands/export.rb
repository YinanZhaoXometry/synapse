# frozen_string_literal: true

# The Export context (AD-12): the Settings account half's data export lives
# under app/commands/export/ (one directory per context, epic-03 kickoff
# delta 4). One operation — the caller's WHOLE document gathered in the
# import's shape (AD-4/AD-15: the document's shape IS the contract,
# mirrored exactly), the inverse of ::Import::ImportDocumentCommand. It
# reads the existing contexts' tables only; it adds no model and no
# vocabulary of its own — Phase-2-only rows without an import vocabulary
# (annotations, notes, mappings, study focus sets, manual tasks) have no
# place in the document and don't ride.
module Export
end
