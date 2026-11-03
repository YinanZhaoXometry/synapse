# frozen_string_literal: true

module Flashcards
  # Persist a flashcard deck on a material — the Phase-1 flashcard-repository
  # createFlashcards mirror (frontend/src/data/flashcard-repository.ts): a
  # batch of front/back cards, node attribution optional (a task's auto-node
  # gives the deck one — AD-6). The whole batch lands in ONE transaction.
  #
  # Each card carries its client-supplied uuid (Phase-1 mints card uuids
  # client-side via crypto.randomUUID) — the idempotency key per card
  # (AD-12; kickoff delta 3): a same-user replay returns the existing rows
  # untouched (a mixed batch creates only the missing cards); a uuid owned by
  # a DIFFERENT user → VALIDATION_FAILED (never silently link, FR-4).
  #
  # Deviation from Phase-1 (recorded in the ticket Comments): the materialId
  # and nodeId are ownership-checked addresses (delta 2 — foreign/unknown/
  # malformed → NOT_FOUND), where Phase-1 trusted the client's ids; and the
  # card inputs carry clientUuid (the replay key Phase-1 lacks a concept of).
  class CreateFlashcardsCommand < ApplicationCommand
    option :current_user
    option :material_id
    option :node_id, optional: true
    option :cards

    def call
      validation = validate_inputs!
      return validation if validation

      # The uuid ownership check comes BEFORE address resolution (the
      # CreateTaskCommand order): a card uuid that already belongs to another
      # user is VALIDATION_FAILED (delta 3 — never silently link, FR-4),
      # whatever material the batch names.
      return cross_user_uuid_failure if cards.any? { |attrs| foreign_card_uuid?(attrs[:client_uuid]) }

      # The material is addressed through the owner's association path
      # (delta 2): unknown, foreign, and malformed ids are uniformly NOT_FOUND.
      return material_not_found unless material_id.to_s.match?(Accounts::UUID_REGEX)
      material = current_user.materials.find_by(id: material_id)
      return material_not_found unless material

      node = resolve_node
      return node if node.failure?
      node = node.value!

      attempt_batch(material: material, node: node)
    end

    private

    def validate_inputs!
      if cards.empty?
        return Failure(:VALIDATION_FAILED,
                       { message: "a deck needs at least one card", field: :cards })
      end
      cards.each do |attrs|
        unless attrs[:client_uuid].to_s.match?(Accounts::UUID_REGEX)
          return Failure(:VALIDATION_FAILED,
                         { message: "card client uuid is not uuid-shaped", field: :cards })
        end
        if attrs[:front].to_s.strip.empty? || attrs[:back].to_s.strip.empty?
          return Failure(:VALIDATION_FAILED,
                         { message: "card front and back are required", field: :cards })
        end
      end
      uuids = cards.map { |attrs| attrs[:client_uuid] }
      return Failure(:VALIDATION_FAILED,
                     { message: "duplicate client uuids within one batch", field: :cards }) if uuids.uniq.size != uuids.size
      nil
    end

    def resolve_node
      return Success(nil) unless node_id

      unless node_id.match?(Accounts::UUID_REGEX)
        return Failure(:NOT_FOUND, { message: "node not found" })
      end
      node = current_user.knowledge_nodes.find_by(id: node_id)
      node ? Success(node) : Failure(:NOT_FOUND, { message: "node not found" })
    end

    # One transaction for the whole batch (ticket AC). Per-card replay: the
    # uuid is addressed through the owner's scope first, a foreign uuid is
    # refused before anything is created.
    def attempt_batch(material:, node:, retries: 2)
      created_cards = nil
      foreign = nil
      ActiveRecord::Base.transaction do
        foreign = cards.find do |attrs|
          !current_user.flashcards.exists?(id: attrs[:client_uuid]) &&
            Flashcard.exists?(id: attrs[:client_uuid])
        end
        unless foreign
          created_cards = cards.map do |attrs|
            current_user.flashcards.find_by(id: attrs[:client_uuid]) ||
              current_user.flashcards.create!(
                id: attrs[:client_uuid],
                material: material,
                node: node,
                front: attrs[:front],
                back: attrs[:back]
              )
          end
        end
      end
      return cross_user_uuid_failure if foreign

      Success(cards: created_cards)
    rescue ActiveRecord::RecordNotUnique
      # The PK race window between the pre-check and the INSERT (same
      # backstop shape as Plans::PlanCreation's, generalized to a batch): the
      # transaction rolled back, so re-run the whole per-card resolution —
      # whoever won the race is either this user (found on replay) or not
      # (ownership failure). Read the `cards` option (the batch inputs), not
      # a spec-local name: a genuine race used to NameError out of this
      # rescue into a typed-INTERNAL lie (the epic P2-3 review, P1-1).
      if cards.any? { |attrs| foreign_card_uuid?(attrs[:client_uuid]) }
        return cross_user_uuid_failure
      end

      retries.positive? ? attempt_batch(material: material, node: node, retries: retries - 1) : race_failure
    end

    def foreign_card_uuid?(uuid)
      Flashcard.exists?(id: uuid) && !current_user.flashcards.exists?(id: uuid)
    end

    def cross_user_uuid_failure
      Failure(:VALIDATION_FAILED,
              { message: "client uuid already belongs to another user's flashcard", field: :cards })
    end

    def race_failure
      Failure(:INTERNAL, { message: "flashcard uuid race did not settle" })
    end

    def material_not_found
      Failure(:NOT_FOUND, { message: "material not found" })
    end
  end
end
