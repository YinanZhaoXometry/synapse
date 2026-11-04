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
    # The blob row's filename column is varchar(255); without this bound an
    # over-long client filename would surface as ValueTooLong → INTERNAL —
    # a user-reachable input must never map onto that code (review round 1).
    MAX_FILENAME_LENGTH = 255

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
      if filename.to_s.length > MAX_FILENAME_LENGTH
        return Failure(:VALIDATION_FAILED,
                       { message: "filename exceeds #{MAX_FILENAME_LENGTH} characters", field: :filename })
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
      # One transaction (review round 1): a raise between the blob save and
      # the attach would otherwise strand an orphan blob row — invisible
      # (downloadUrl null) and permanent.
      ActiveRecord::Base.transaction do
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
        # The bytes do not exist yet (that is the whole point of the presign),
        # so nothing may later try to download them. Two flags stand for that:
        # `analyzed` (the load-bearing one, a persisted column) — on attach,
        # Attachment#analyze_blob_later enqueues an AnalyzeJob for any
        # un-analyzed blob, a download-hungry job this flow can never satisfy;
        # marking analysis terminal up front keeps the AD-19 posture (the only
        # analyzer accepting pdf/markdown/text, the NullAnalyzer, would produce
        # exactly metadata { analyzed: true } and nothing else).
        # `identified` is parity/defense, not persisted — identification
        # (CreateOne's first-4-KiB download) only runs for IO attachables, and
        # this call attaches an already-built Blob instance, which skips it;
        # setting the flag matches the builder's create_and_upload!(
        # identify: false) semantics anyway.
        blob.identified = true
        blob.analyzed = true
        blob.save!(validate: false)
        material.original.attach(blob)
        blob
      end
    end

    def object_key
      "#{Storage::KEY_PREFIX}/#{current_user.id}/#{SecureRandom.uuid}" \
        "#{Storage::UPLOADABLE_CONTENT_TYPES.fetch(content_type.to_s)}"
    end

    def presigned_put(key)
      Storage.presigned_put_url(key, expires_in: upload_ttl_seconds, content_type: content_type)
    end
  end
end
