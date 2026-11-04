# frozen_string_literal: true

module Storage
  # Mint a presigned direct upload for a user-owned material (AD-13, epic
  # P2-6 ticket 02). The ActiveStorage-native linkage (the epic kickoff's
  # recorded decision): the server mints the Blob NOW — the direct-upload
  # builder whose whole contract is "create the blob row before the bytes
  # exist; the presigned URL points at its key" — owning the object key
  # (materials/{user_id}/{uuid}{ext}), and attaches it to the Material
  # (has_one_attached :original) in the same call, so Material.downloadUrl
  # can address the object as soon as the browser's PUT has landed. No
  # write-back, no callback: the key never travels to the client as data —
  # it rides the blob, and the blob rides the attachment.
  #
  # The presigned PUT itself is a v4 URL over the configured ActiveStorage
  # S3 service (minio in dev/test, R2 in prod — one shape, storage.yml), TTL
  # UPLOAD_PRESIGN_TTL_SECONDS from the constant. Downloads are the separate
  # presigned-GET field (DOWNLOAD_PRESIGN_TTL_SECONDS), never persisted.
  #
  # Scoping + validation: the materialId is an ownership-checked address
  # (delta 2) — unknown, foreign, and malformed ids are uniformly
  # NOT_FOUND; filename/contentType/size validate with typed Failures
  # (VALIDATION_FAILED) before anything is minted.
  class CreateMaterialUploadCommand < ApplicationCommand
    option :current_user
    option :filename
    option :content_type
    option :size
    option :material_id
    # The TTL injection seam for the minio expiry spec (it proves expired
    # URLs are refused without sleeping); every other call site runs the
    # constant. The Presigner refuses non-positive values itself — expired
    # URLs are proven via a past signing time, not a negative TTL.
    option :upload_ttl_seconds, default: -> { Storage::UPLOAD_PRESIGN_TTL_SECONDS }

    def call
      validation = validate!
      return validation if validation

      material = material_scope
      return material if material.failure?

      blob = mint_and_attach(material.value!)

      Success(
        upload_url: presigned_put(blob.key),
        blob_key: blob.key,
        material_id: material.value!.id,
        expires_at: Time.current + upload_ttl_seconds
      )
    end

    private

    def validate!
      if filename.to_s.strip.empty?
        return Failure(:VALIDATION_FAILED, { message: "filename is required", field: :filename })
      end
      unless Storage::UPLOADABLE_CONTENT_TYPES.key?(content_type.to_s)
        return Failure(:VALIDATION_FAILED,
                       { message: "content type is not an uploadable document type", field: :contentType })
      end
      unless size.is_a?(Integer) && size.positive?
        return Failure(:VALIDATION_FAILED, { message: "size must be positive", field: :size })
      end
      if size > Storage::MAX_UPLOAD_BYTES
        return Failure(:VALIDATION_FAILED,
                       { message: "size exceeds the #{Storage::MAX_UPLOAD_BYTES}-byte cap", field: :size })
      end

      nil
    end

    # The scope is an ownership-checked address (delta 2): unknown, foreign,
    # and malformed ids are uniformly NOT_FOUND.
    def material_scope
      unless material_id.to_s.match?(Accounts::UUID_REGEX)
        return Failure(:NOT_FOUND, { message: "material not found" })
      end

      material = current_user.materials.find_by(id: material_id)
      material ? Success(material) : Failure(:NOT_FOUND, { message: "material not found" })
    end

    def mint_and_attach(material)
      # The direct-upload builder's exact row shape
      # (ActiveStorage::Blob.create_before_direct_upload!) minus one
      # validation: that builder validates checksum presence, and this flow
      # has no client checksum — the mutation surface carries none, the
      # browser PUTs raw bytes against the signed URL, so checksum stays
      # null, exactly what the column's nullability allows (upstream dropped
      # its NOT NULL in 2021). Built with the same arguments the builder
      # passes to create!; service_name is filled from the configured
      # service the same way the builder's after_initialize does.
      blob = ActiveStorage::Blob.new(
        key: object_key,
        filename: filename.to_s,
        byte_size: size,
        content_type: content_type,
        service_name: ActiveStorage::Blob.service.name
      )
      # The attachment path identifies blobs by downloading their first 4 KiB
      # from the service (Attached::Changes::CreateOne) and re-analyzes them
      # on attach (Attachment#analyze_blob_later) — both need the bytes,
      # which have not been uploaded yet (that is the whole point of the
      # presign). Marking the blob identified + analyzed stands for: the
      # content type was decided deliberately, from the validated allowlist
      # value (the same decision create_and_upload!(identify: false)
      # expresses), and analysis is already terminal — the NullAnalyzer
      # (the only analyzer that accepts pdf/markdown/text) would produce
      # exactly metadata { analyzed: true } and nothing else.
      blob.identified = true
      blob.analyzed = true
      blob.save!(validate: false)
      material.original.attach(blob)
      blob
    end

    def object_key
      "#{Storage::KEY_PREFIX}/#{current_user.id}/#{SecureRandom.uuid}" \
        "#{Storage::UPLOADABLE_CONTENT_TYPES.fetch(content_type.to_s)}"
    end

    def presigned_put(key)
      Storage.presigned_put_url(key, expires_in: upload_ttl_seconds)
    end
  end
end
