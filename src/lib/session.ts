// Shared-PIN auth (task #24 follow-up). This app has exactly two users
// (the owner and Ella) sharing one household — Supabase's per-user magic-link
// auth was causing real bugs (concurrent refresh-token races bouncing nav
// taps back to /login) for a security model this app doesn't need. The
// replacement: one PIN, known to both people, unlocks a long-lived signed
// cookie. Convenience over security is an explicit, confirmed decision — see
// task #24 chat history — not an oversight.
//
// Uses Web Crypto (`crypto.subtle`) rather than Node's `crypto` module so the
// same code runs unmodified in both the Edge-runtime proxy (src/proxy.ts) and
// Node-runtime Server Actions/Route Handlers.
//
// The session cookie's value is a deterministic HMAC-SHA256 signature of a
// fixed message, keyed by APP_PIN: anyone who knows the PIN can compute the
// same cookie value, and there's no per-session state to store or expire —
// changing APP_PIN invalidates every existing cookie at once.

export const SESSION_COOKIE = "subarashii_session";

const SESSION_MESSAGE = "subarashii-auth-v1";

function requirePin(): string {
  const pin = process.env.APP_PIN;
  if (!pin) {
    throw new Error(
      "APP_PIN is not set. Add it to .env.local (dev) or the Vercel project's environment variables (production).",
    );
  }
  return pin;
}

async function hmacKey(pin: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Explicitly backed by a plain ArrayBuffer (not the wider ArrayBufferLike a
// bare `new Uint8Array(n)` infers) so this satisfies `BufferSource` when
// passed to crypto.subtle.verify below.
function hexToBytes(hex: string): Uint8Array<ArrayBuffer> | null {
  if (hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) {
    return null;
  }
  const buffer = new ArrayBuffer(hex.length / 2);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** The value to store in the session cookie once a correct PIN is entered. */
export async function createSessionCookieValue(): Promise<string> {
  const key = await hmacKey(requirePin());
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(SESSION_MESSAGE),
  );
  return bytesToHex(sig);
}

/** Checks whether a cookie value is a valid signature for the current APP_PIN. */
export async function isValidSessionCookieValue(
  value: string | undefined | null,
): Promise<boolean> {
  if (!value) return false;
  const pin = process.env.APP_PIN;
  if (!pin) return false;
  const sigBytes = hexToBytes(value);
  if (!sigBytes) return false;

  const key = await hmacKey(pin);
  // crypto.subtle.verify does a constant-time comparison internally, unlike
  // a manual `===`/loop compare of the two hex strings.
  return crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes,
    new TextEncoder().encode(SESSION_MESSAGE),
  );
}

/**
 * Constant-time-ish comparison of a user-submitted PIN against APP_PIN.
 * Deliberately simple: this is a low-stakes, rate-limited, 2-person-app
 * check, not a defense against a sophisticated timing attack.
 */
export function isCorrectPin(candidate: string): boolean {
  const expected = process.env.APP_PIN;
  if (!expected) return false;
  if (candidate.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= candidate.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}
