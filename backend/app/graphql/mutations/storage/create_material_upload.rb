# frozen_string_literal: true

module Mutations
  module Storage
    # Presign a direct upload for a user-owned material (AD-13, epic P2-6
    # ticket 02) — thin per AD-12: authorize → command → map. Every rule
    # (the content-type allowlist, the 100 MiB cap, the uniform NOT_FOUND
    # scoping, the server-side blob linkage) lives in
    # ::Storage::CreateMaterialUploadCommand; this boundary owns only the
    # wire shape. The object key is deliberately NOT on the wire — it rides
    # the blob, and the blob rides the attachment.
    class CreateMaterialUpload < BaseMutation
      description "Presign a direct upload for an existing material (AD-13): returns a short-lived presigned PUT URL that the browser PUTs the file bytes to directly (R2/minio — the bytes never pass through the api). The blob is minted server-side and attached to the material at presign time; downloads then flow through Material.downloadUrl. VALIDATION_FAILED for a non-document content type, a non-positive size, or a size beyond the 100 MiB cap; unknown, foreign, and malformed material ids are uniformly NOT_FOUND."

      argument :material_id, String,
               required: true,
               description: "The material the upload attaches to. Unknown, foreign, and malformed ids are uniformly NOT_FOUND."

      argument :filename, String,
               required: true,
               description: "The client filename — kept as blob metadata only (255-character cap, VALIDATION_FAILED beyond); the object key derives its extension from the validated content type, never from this name."

      argument :content_type, String,
               required: true,
               description: "The file's content type — allowlisted to application/pdf, text/markdown, text/plain (VALIDATION_FAILED beyond). The presigned PUT signs this value: the browser must PUT with exactly this Content-Type header."

      argument :size, Int,
               required: true,
               description: "The file's size in bytes; positive and capped at 100 MiB (VALIDATION_FAILED beyond). Advisory on the wire — a presigned PUT cannot pin Content-Length — but pinned at validation time."

      field :upload_url, String,
            null: false,
            description: "The presigned PUT URL (15-minute TTL, signed over the declared content type) — the browser PUTs the bytes here, never to the api. Usable until expiry; a re-PUT within the window replaces the bytes."

      field :material_id, String,
            null: false,
            description: "The material the upload attaches to (echoed)."

      field :expires_at, Types::DateTime,
            null: false,
            description: "When the presigned PUT expires."

      def resolve(material_id:, filename:, content_type:, size:)
        command_result(::Storage::CreateMaterialUploadCommand.call(
          current_user: current_user!,
          material_id: material_id,
          filename: filename,
          content_type: content_type,
          size: size
        ))
      end
    end
  end
end
