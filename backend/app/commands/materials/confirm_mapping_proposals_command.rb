# frozen_string_literal: true

module Materials
  # Confirm proposed mapping rows (FR-45, epic P2-10 T1; delta decisions 3+4):
  # the user's confirmation turns AI proposals into the plan's real node
  # layer. Rows grouped by a shared proposed_node_title become ONE real
  # plan-scoped KnowledgeNode (stage null — stage assignment stays a human
  # concern; order = the plan's max + 1, consecutive across groups; the
  # title dedupes against the plan's existing nodes so a title the plan
  # already covers reuses that node). Rows already pointed at a node flip
  # status only. Rows already decided (confirmed | rejected) return
  # UNCHANGED — a stale bulk click never resurrects a rejected proposal nor
  # rewrites a confirmed mapping. Unknown, malformed, and foreign ids are
  # uniformly NOT_FOUND (kickoff delta 2) and change nothing.
  class ConfirmMappingProposalsCommand < ApplicationCommand
    option :current_user
    option :mapping_ids

    def call
      ids = Array(mapping_ids).map(&:to_s)
      return Failure(:VALIDATION_FAILED, { message: "no mapping rows given", field: :mappingIds }) if ids.empty?

      rows = scoped_rows(ids)
      return Failure(:NOT_FOUND, { message: "mapping not found" }) unless rows

      confirmable = rows.select(&:proposed?)
      # A title-grouped row confirms INTO a plan — its material must still be
      # plan-attached (the map command refuses unattached materials, so this
      # only fires on a row whose material detached after proposing).
      if confirmable.any? { |row| row.proposed_node_title.present? && row.material.plan_id.nil? }
        return Failure(:VALIDATION_FAILED,
                       { message: "the material is not attached to a plan", field: :mappingIds })
      end

      assignments = {}
      ActiveRecord::Base.transaction do
        title_groups(confirmable).each_value do |group_rows|
          node = resolve_or_create_node(group_rows.first)
          group_rows.each { |row| assignments[row.id] = node.id }
        end
        confirmable.each do |row|
          row.update!(status: :confirmed, node_id: assignments[row.id] || row.node_id)
        end
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

    # Proposed rows naming a coverage gap group by their (stripped) proposed
    # title; rows pointed at an existing node carry no title and confirm
    # individually.
    def title_groups(rows)
      rows.select { |row| row.proposed_node_title.present? }
          .group_by { |row| row.proposed_node_title.strip }
    end

    # One node per title group: reuse the plan's existing same-title node
    # when there is one, else create it at the plan's max order + 1 (the
    # transaction serializes the groups, so consecutive groups get
    # consecutive orders).
    def resolve_or_create_node(row)
      plan_id = row.material.plan_id
      title = row.proposed_node_title.strip

      existing = current_user.knowledge_nodes.find_by(plan_id: plan_id, title: title)
      return existing if existing

      order = (current_user.knowledge_nodes.where(plan_id: plan_id).maximum(:order) || -1) + 1
      KnowledgeNode.create!(user_id: current_user.id, plan_id: plan_id, title: title, stage: nil, order: order)
    end
  end
end
