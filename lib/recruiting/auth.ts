// Gate for /recruiting. The cookie value is an HMAC-SHA256 over a fixed
// payload keyed by RECRUITING_KEY, so it cannot be forged without the key and
// a key rotation logs everyone out. Web Crypto only: this runs in the edge
// middleware and in Node (vitest) unchanged.

export const RECRUITING_COOKIE = "recruiting_session";
export const RECRUITING_COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

const PAYLOAD = "aaronsulbaran.com/recruiting:v1";

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

export async function signSession(secret: string): Promise<string> {
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(PAYLOAD));
  return toHex(sig);
}

// Constant-time string compare so a timing side channel cannot leak the key
// or the signature one byte at a time.
export function timingSafeEqual(a: string, b: string): boolean {
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  let diff = ab.length ^ bb.length;
  const n = Math.max(ab.length, bb.length);
  for (let i = 0; i < n; i += 1) {
    diff |= (ab[i % ab.length] ?? 0) ^ (bb[i % bb.length] ?? 0);
  }
  return diff === 0;
}

export async function verifySession(
  cookieValue: string | undefined,
  secret: string | undefined,
): Promise<boolean> {
  if (!secret || !cookieValue) return false;
  const expected = await signSession(secret);
  return timingSafeEqual(cookieValue, expected);
}

export function keyMatches(candidate: string | null, secret: string | undefined): boolean {
  if (!secret || !candidate) return false;
  return timingSafeEqual(candidate, secret);
}
