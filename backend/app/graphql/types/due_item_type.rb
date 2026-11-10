# frozen_string_literal: true

module Types
  # One due review on the re-queue (AD-19/FR-24/FR-27, epic P2-7 ticket 03):
  # a mistake or a flashcard whose requeue_schedules row says it is due, with
  # everything epic-09's Today hub needs to render the row and deep-link into
  # the study flow — the node (→ its plan/task), the material, the question
  # for mistakes (prompt + source locator), the front text for flashcards.
  # The row is the scan's materialized schedule; due-ness itself was derived
  # correct-on-wake (ticket 02). itemType is the wire discriminator
  # ("mistake" | "flashcard").
  class DueItemType < Types::BaseObject
    description "A due review (FR-24): a mistake or flashcard the re-queue says to resurface, with its study-flow links (FR-27's task-list shape)."

    field :item_type, String,
          null: false,
          description: "\"mistake\" or \"flashcard\"."

    field :item_id, String,
          null: false,
          description: "The source row's uuid (MistakeEntry or Flashcard id — plain UUID strings, AD-12)."

    field :due_at, Types::DateTime,
          null: false,
          description: "When the re-queue scheduled this item to resurface (the scan's correct-on-wake recompute)."

    field :stage, Int,
          null: false,
          description: "The schedule's ladder stage (mistakes advance on distinct-UTC-day correct answers — epic-31's same-day guard; flashcards carry their easy-streak stage from the self-rating — epic-31's geometric ladders)."

    field :title, String,
          null: false,
          description: "The question's prompt (mistakes) or the card's front (flashcards) — what the Today row renders."

    field :node_id, String,
          null: true,
          description: "The knowledge node under study (null for flashcards created without one)."

    field :plan_id, String,
          null: true,
          description: "The plan the node belongs to (through the node; null when the node is planless/unlinked)."

    field :task_id, String,
          null: true,
          description: "The task the node belongs to (through the node; null when the node is taskless/unlinked)."

    field :material_id, String,
          null: true,
          description: "The source material (the mistake's question's source material, or the flashcard's deck material)."

    field :question_id, String,
          null: true,
          description: "The mistaken question (mistakes only)."

    field :source_location, Types::ReadingLocatorType,
          null: true,
          description: "Where the mistake sits in its material (mistakes only, AD-2's ReadingLocator jsonb)."

    ITEM_TYPES = { "MistakeEntry" => "mistake", "Flashcard" => "flashcard" }.freeze

    def item_type
      ITEM_TYPES.fetch(schedulable.class.name)
    end

    def item_id
      schedulable.id
    end

    def due_at
      object.next_due_at
    end

    def stage
      object.stage
    end

    def title
      case schedulable
      when MistakeEntry then schedulable.question.prompt
      else schedulable.front
      end
    end

    def node_id
      schedulable.node_id
    end

    # The plan/task links ride the node (AD-6's node plan_id/task_id columns)
    # — one load serves both.
    def plan_id
      node&.plan_id
    end

    def task_id
      node&.task_id
    end

    def material_id
      case schedulable
      when MistakeEntry then schedulable.question.source_material_id
      else schedulable.material_id
      end
    end

    # Mistake-only fields: flashcards have neither column, so the type guard
    # is load-bearing (an unconditional delegation would NoMethodError the
    # whole item).
    def question_id
      schedulable.is_a?(MistakeEntry) ? schedulable.question_id : nil
    end

    def source_location
      schedulable.is_a?(MistakeEntry) ? schedulable.source_location : nil
    end

    private

    def schedulable
      @schedulable ||= object.schedulable
    end

    def node
      return unless schedulable.respond_to?(:node) && schedulable.node_id

      @node ||= schedulable.node
    end
  end
end
