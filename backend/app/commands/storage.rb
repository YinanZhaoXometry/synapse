# frozen_string_literal: true

# The Storage context (AD-13, epic P2-6): the byte-story commands — the
# presigned direct-upload surface — live under app/commands/storage/.
# Deliberately its own context, not Materials::: the Materials namespace's
# contract is "no bytes ever pass through here" (AD-7 client-side parsing,
# extracted text in Postgres), and presigning is epic-06's byte story that
# crosses into ActiveStorage/object storage. Epic-03's material record keeps
# owning metadata; this context owns bytes only (the epic's coordination
# note) — the overlap is exactly the ActiveStorage attachment.
module Storage
  # The presign TTLs (epic P2-6 kickoff choice 6 — short-lived per AD-13,
  # values in config constants, never literals at call sites): the presigned
  # PUT a browser uses for createMaterialUpload, and the presigned GET the
  # Material.downloadUrl field mints per request (never persisted anywhere).
  UPLOAD_PRESIGN_TTL_SECONDS = 15 * 60
  DOWNLOAD_PRESIGN_TTL_SECONDS = 5 * 60

  # The upload-size cap → VALIDATION_FAILED beyond. 100 MiB is the sane
  # ceiling for study documents (PDFs and text/markdown notes — the Phase-1
  # Material kinds).
  MAX_UPLOAD_BYTES = 100 * 1024 * 1024

  # The content-type allowlist → VALIDATION_FAILED beyond. The value is the
  # object-key extension minted for that type: the key convention derives the
  # extension from the VALIDATED content type, never from the client
  # filename, so the key shape cannot be gamed by the upload payload.
  UPLOADABLE_CONTENT_TYPES = {
    "application/pdf" => ".pdf",
    "text/markdown" => ".md",
    "text/plain" => ".txt"
  }.freeze

  # The object-key convention (epic P2-6 kickoff choice 5):
  # materials/{user_id}/{uuid}{ext} — user-sharded, collision-free, readable
  # in the bucket.
  KEY_PREFIX = "materials"

  # The shared presign seam (epic P2-6 ticket 02): v4 presigned URLs over the
  # configured ActiveStorage S3 service (minio in dev/test, R2 in prod — one
  # shape, storage.yml), minted per call — constructed per call too (cheap,
  # no network) so no presigner can outlive a service swap. Both consumers
  # sit here — the createMaterialUpload command (PUT) and the
  # Material.downloadUrl field (GET) — so the construction exists exactly
  # once. URLs point at the storage provider, never at the backend
  # (backend/AGENTS.md).
  #
  # The PUT signs content_type when given (review round 1): without it the
  # provider stores whatever Content-Type the client sent, decoupling the
  # served bytes' type from the validated allowlist value — with it, the
  # browser MUST PUT with exactly the declared type or the signature check
  # refuses. (Size cannot be pinned by a presigned PUT — Content-Length is
  # set by the HTTP client after signing — so the 100 MiB cap stays a
  # validation-time claim; enforcing it byte-wise would need a POST policy,
  # not a presigned URL.)
  def self.presigned_put_url(key, expires_in: UPLOAD_PRESIGN_TTL_SECONDS, content_type: nil)
    params = { bucket: service.bucket.name, key: key, expires_in: expires_in }
    params[:content_type] = content_type if content_type
    presigner.presigned_url(:put_object, **params)
  end

  def self.presigned_get_url(key, expires_in: DOWNLOAD_PRESIGN_TTL_SECONDS)
    presigner.presigned_url(:get_object, bucket: service.bucket.name, key: key, expires_in: expires_in)
  end

  # The ActiveStorage-configured S3 service: the Resource wraps the Client,
  # and the Presigner wants the wrapped Aws::S3::Client.
  def self.presigner
    Aws::S3::Presigner.new(client: service.client.client)
  end

  def self.service
    ActiveStorage::Blob.service
  end
end
