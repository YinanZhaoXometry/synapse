# frozen_string_literal: true

# The Ai context root (epic P2-5): everything server-side AI lives under
# Ai::* — app/lib/ai/* (the seam, GLM transport, context assembly — the
# sibling of Accounts::* per the app/lib convention) and the AI commands
# under app/commands/ai/* (AD-16). Note app/* directory names are invisible
# to Zeitwerk (app/models/user.rb → User), so the context constant comes
# from this file and the app/lib/ai/ subdirectory, not from a directory
# named "ai" at the app root.
module Ai
end
