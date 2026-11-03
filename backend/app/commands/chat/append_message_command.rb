# frozen_string_literal: true

module Chat
  # Append one Companion-conversation message — the Phase-1
  # progress-repository appendChatMessage mirror
  # (frontend/src/data/progress-repository.ts): the thread is 1:1 with its
  # material (unique index) and is created on first append; the message
  # embeds as a jsonb row ({id, role, text, citations, createdAt} — TS keys
  # verbatim, AD-2) with a SERVER-minted id and createdAt (the Phase-1
  # client clock never reaches a row), and the thread's updated_at moves
  # with the append.
  #
  # Deviations from Phase-1 (recorded in the ticket Comments): the material
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
    option :material_id
    option :message

    def call
      # A non-uuid id addresses no row — the same uniform NOT_FOUND a
      # foreign id gets (a malformed address must not degrade into an
      # INTERNAL 500).
      return material_not_found unless material_id.to_s.match?(Accounts::UUID_REGEX)
      material = current_user.materials.find_by(id: material_id)
      return material_not_found unless material

      validation = validate_message!
      return validation if validation

      row = message_as_jsonb
      ActiveRecord::Base.transaction do
        thread = current_user.chat_threads.find_by(material_id: material.id)
        unless thread
          begin
            thread = current_user.chat_threads.create!(material: material, messages: [])
          rescue ActiveRecord::RecordNotUnique
            # The unique-material_id race between the pre-check and the
            # INSERT (the delta-3 backstop shape): the winner's thread
            # exists now — read it back and append to it.
            thread = current_user.chat_threads.find_by!(material_id: material.id)
          end
        end
        thread.update!(messages: thread.messages + [ row ], updated_at: row_timestamp(row))
      end
      Success(message: row)
    end

    private

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
  end
end
