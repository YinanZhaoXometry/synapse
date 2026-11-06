# frozen_string_literal: true

module Chat
  # Append one Companion-conversation message — the Phase-1
  # progress-repository appendChatMessage mirror
  # (frontend/src/data/progress-repository.ts): the thread is 1:1 with its
  # scope (a material, or — epic-25 T1 — a plan; exactly-one of
  # material_id/plan_id, the chat_threads_one_scope floor) and is created
  # on first append; the message embeds as a jsonb row
  # ({id, role, text, citations, createdAt} — TS keys verbatim, AD-2) with
  # a SERVER-minted id and createdAt (the Phase-1 client clock never
  # reaches a row), and the thread's updated_at moves with the append.
  #
  # Deviations from Phase-1 (recorded in the ticket Comments): the scope
  # is addressed through the owner's association path (delta 2 — unknown/
  # foreign/malformed → NOT_FOUND, where Phase-1 trusted the client's ids);
  # the role vocabulary and the locator shapes are validated server-side
  # (Phase-1 persisted whatever arrived). No client uuid exists on the
  # Phase-1 op, so the append is NOT replay-idempotent — every call appends
  # exactly one message (the recordEvidence posture: the exactly-once
  # discipline belongs to the client driver).
  class AppendMessageCommand < ApplicationCommand
    include ReadingLocators

    option :current_user
    option :material_id, optional: true
    option :plan_id, optional: true
    option :message

    def call
      return scope_failure unless exactly_one_scope?

      scope = resolve_scope
      return scope unless scope.success?

      validation = validate_message!
      return validation if validation

      row = message_as_jsonb
      anchor = scope.value!
      ActiveRecord::Base.transaction do
        thread = current_user.chat_threads.find_by(anchor_key => anchor.id)
        unless thread
          begin
            # The create attempt runs in a SAVEPOINT (requires_new — the Rails
            # create_or_find_by pattern): the unique-scope-index race's failed
            # INSERT otherwise aborts the enclosing Postgres transaction, and
            # every later statement — including the winner's-row read-back
            # below — would die with PG::InFailedSqlTransaction. (The rescue's
            # old comment claimed the winner's row was simply readable after
            # the failure — true only with no enclosing transaction.)
            ActiveRecord::Base.transaction(requires_new: true) do
              thread = current_user.chat_threads.create!(anchor_key => anchor, messages: [])
            end
          rescue ActiveRecord::RecordNotUnique
            # The unique-scope-index race between the pre-check and the
            # INSERT (the delta-3 backstop shape): the winner's thread
            # exists now — read it back and append to it. Safe because the
            # savepoint rolled back only the failed INSERT.
            thread = current_user.chat_threads.find_by!(anchor_key => anchor.id)
          end
        end
        thread.update!(messages: thread.messages + [ row ], updated_at: row_timestamp(row))
      end
      Success(message: row)
    end

    private

    # The exactly-one addressing gate (epic-25 T1): both or neither of
    # material_id / plan_id is a client shape bug, not an addressing miss —
    # VALIDATION_FAILED with field: :scope (neither is NOT the material
    # path's NOT_FOUND: no scope was claimed at all).
    def exactly_one_scope?
      material_id.present? ^ plan_id.present?
    end

    def scope_failure
      Failure(:VALIDATION_FAILED,
              { message: "exactly one of material_id / plan_id is required", field: :scope })
    end

    # Resolve the claimed scope through the owner's association path —
    # a non-uuid id addresses no row, the same uniform NOT_FOUND a foreign
    # id gets (a malformed address must not degrade into an INTERNAL 500).
    # Success carries the anchor row; the anchor's class picks the
    # thread's lookup/create key below.
    def resolve_scope
      if material_id.present?
        return material_not_found unless material_id.to_s.match?(Accounts::UUID_REGEX)
        material = current_user.materials.find_by(id: material_id)
        return material_not_found unless material

        Success(material)
      else
        return plan_not_found unless plan_id.to_s.match?(Accounts::UUID_REGEX)
        plan = current_user.study_plans.find_by(id: plan_id)
        return plan_not_found unless plan

        Success(plan)
      end
    end

    def anchor_key
      material_id.present? ? :material : :plan
    end

    def validate_message!
      unless Chat::ROLES.include?(message[:role].to_s)
        return Failure(:VALIDATION_FAILED,
                       { message: "message role is invalid (user | companion)", field: :role })
      end
      if message[:text].to_s.strip.empty?
        return Failure(:VALIDATION_FAILED, { message: "message text is required", field: :text })
      end
      message[:citations].each do |locator|
        failure = validate_locator!(locator, field: :citations)
        return failure if failure
      end
      nil
    end

    # The jsonb row the factories pin: string-keyed, TS keys verbatim. The
    # text is stored as sent — no trimming server-side (a silent rewrite of
    # the client's content is not a contract the api should have; the T02
    # no-truncation posture).
    def message_as_jsonb
      {
        "id" => SecureRandom.uuid,
        "role" => message[:role].to_s,
        "text" => message[:text],
        "citations" => message[:citations].map { |locator| locator_as_jsonb(locator) },
        "createdAt" => Time.current.utc.iso8601
      }
    end

    def row_timestamp(row)
      Time.zone.parse(row["createdAt"])
    end

    def material_not_found
      Failure(:NOT_FOUND, { message: "material not found" })
    end

    def plan_not_found
      Failure(:NOT_FOUND, { message: "plan not found" })
    end
  end
end
