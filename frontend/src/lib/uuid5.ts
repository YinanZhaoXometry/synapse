/**
 * The RFC 4122 §4.3 name-based uuid (version 5, SHA-1) — the byte-level
 * CLIENT MIRROR of backend `Ai::TodaySuggestionKey` (epic-18 T2, spec
 * decision 9): the deterministic per-(user, plan, UTC day) replay key that
 * makes a same-day regeneration REPLAY the persisted suggestion for free
 * (replay-before-spend — zero provider calls, zero cap consumption). The
 * derivation must match the server hex-for-hex or a replay becomes a spend:
 *
 *   namespace = the user's uuid, taken AS an RFC-4122 namespace (the 32
 *               hex digits, dashes stripped, as the 16 namespace bytes)
 *   name      = "<planId>:<UTC day>" — the UTC day formatted "YYYY-MM-DD"
 *   uuid5     = SHA-1(namespace_bytes + name), first 16 bytes, the version
 *               nibble forced to 5, the variant bits forced to 10 (RFC-4122),
 *               formatted lowercase 8-4-4-4-12.
 *
 * SHA-1 lives here too (zero-new-deps NFR-6): web crypto has digest but it
 * is async and uuidv5 is nowhere in the dependency set — the algorithm is
 * the standard FIPS 180-1 compression function, small enough to own. The
 * pinned vectors in uuid5.test.ts are the backend unit spec's own, so any
 * drift fails loudly on both stacks.
 */

/** FIPS 180-1 SHA-1 over a byte message → the 20 digest bytes. */
function sha1(message: Uint8Array): Uint8Array {
  const bitLength = message.length * 8;
  // Pad to a multiple of 64: the message, 0x80, zeros, the 64-bit BE bit length.
  const padded = new Uint8Array((((message.length + 8) >> 6) + 1) << 6);
  padded.set(message);
  padded[message.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bitLength / 0x100000000), false);
  view.setUint32(padded.length - 4, bitLength >>> 0, false);

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;
  const w = new Uint32Array(80);

  for (let block = 0; block < padded.length; block += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(block + i * 4, false);
    for (let i = 16; i < 80; i++) {
      const n = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16];
      w[i] = (n << 1) | (n >>> 31);
    }
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    for (let i = 0; i < 80; i++) {
      let f: number;
      let k: number;
      if (i < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const t = (((a << 5) | (a >>> 27)) + f + e + k + w[i]) >>> 0;
      e = d;
      d = c;
      c = (b << 30) | (b >>> 2);
      b = a;
      a = t;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }

  const digest = new Uint8Array(20);
  const out = new DataView(digest.buffer);
  out.setUint32(0, h0, false);
  out.setUint32(4, h1, false);
  out.setUint32(8, h2, false);
  out.setUint32(12, h3, false);
  out.setUint32(16, h4, false);
  return digest;
}

/** The RFC 4122 §4.3 uuid5 string from a uuid-shaped namespace and a name. */
export function uuid5(namespace: string, name: string): string {
  const namespaceHex = namespace.replace(/-/g, "");
  const nameBytes = new TextEncoder().encode(name);
  const bytes = new Uint8Array(16 + nameBytes.length);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(namespaceHex.slice(i * 2, i * 2 + 2), 16);
  }
  bytes.set(nameBytes, 16);
  const digest = sha1(bytes).slice(0, 16);
  digest[6] = (digest[6] & 0x0f) | 0x50; // version 5
  digest[8] = (digest[8] & 0x3f) | 0x80; // RFC 4122 variant (10xx)
  const hex = Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** The Today suggestion's replay key (the mutation's clientUuid): uuid5 over
 * the USER-SCOPED namespace + planId + UTC day — Ai::TodaySuggestionKey's
 * derivation verbatim. The day half follows the streak's midnight-UTC
 * boundary convention (ADR-0001); the caller formats it "YYYY-MM-DD"
 * (domain/today-week's utcDayKey). */
export function todaySuggestionClientUuid(userUuid: string, planId: string, utcDay: string): string {
  return uuid5(userUuid, `${planId}:${utcDay}`);
}
