/**
 * Client-supplied uuid v4 minting — the single choke point for AD-12
 * idempotency keys and every locally-generated entity id.
 *
 * crypto.randomUUID is secure-context-only (HTTPS or localhost; Chrome 92+,
 * Safari 15.4+): on a plain-IP or hosts-alias origin — the LAN demo access,
 * http://192.168.x.x:8080 — the method does not exist and every mint would
 * throw `crypto.randomUUID is not a function`. The fallback formats 16
 * getRandomValues bytes into an RFC 4122 v4 string; getRandomValues itself
 * exists in every context, secure or not.
 */

/** RFC 4122 v4 string from 16 random bytes (version + variant bits set). */
function uuidFromBytes(bytes: Uint8Array): string {
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function newClientUuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return uuidFromBytes(crypto.getRandomValues(new Uint8Array(16)));
}
