# frozen_string_literal: true

module Materials
  # Reject proposed mapping rows (FR-45, epic P2-10 T1; delta decisions 3+4):
  # the user's rejection persists as a `rejected` row — the record that
  # makes "never re-proposed" durable (the map command skips rejected
  # sections forever). Rows already decided (confirmed | rejected) return
  # UNCHANGED — a rejected mapping is never resurrected, a confirmed one
  # never undone through this door. Unknown, malformed, and foreign ids are
  # uniformly NOT_FOUND (kickoff delta 2) and change nothing.
  class RejectMappingProposalsCommand < ApplicationCommand
    option :current_user
    option :mapping_ids

    def call
      ids = Array(mapping_ids).map(&:to_s)
      return Failure(:VALIDATION_FAILED, { message: "no mapping rows given", field: :mappingIds }) if ids.empty?

      rows = scoped_rows(ids)
      return Failure(:NOT_FOUND, { message: "mapping not found" }) unless rows

      ActiveRecord::Base.transaction do
        rows.select(&:proposed?).each { |row| row.update!(status: :rejected) }
      end

      Success(mappings: rows.map(&:reload))
    end

    private

    # Every id must address THIS user's rows — one foreign/unknown/malformed
    # id fails the whole batch BEFORE anything changes (delta 2's uniform
    # NOT_FOUND: malformed addresses never become 500s or partial writes).
    def scoped_rows(ids)
      return nil unless ids.all? { |id| id.match?(Accounts::UUID_REGEX) }

      rows = current_user.material_node_mappings.where(id: ids).index_by(&:id)
      return nil unless ids.all? { |id| rows.key?(id) }

      ids.map { |id| rows[id] }
    end
  end
end
