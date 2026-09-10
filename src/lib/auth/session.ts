import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Real, stateless, signed session tokens — HMAC-SHA256 over
 * `${address}.${expiry}` using a server-only secret. No database needed:
 * the token is self-verifying, like a minimal JWT. Issued only after a
 * real signature from the connected wallet is verified against a
 * freshly-challenged message (see /api/auth/challenge, /api/auth/verify,
 * and lib/auth/siwe.ts) — this is the actual authorization boundary the
 * project's security rules require: no state-changing KeeperHub operation
 * trusts a client-supplied address without this.
 *
 * MASTRA_SESSION_SECRET must be set for any of this to work; there is no
 * insecure fallback — an unset secret is a hard configuration error, not a
 * silently-open door.
 */

const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12h

function getSecret(): string {
  const secret = process.env.MASTRA_SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "MASTRA_SESSION_SECRET is not set — required to issue or verify session tokens. Set a long random value in your server environment.",
    );
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function createSessionToken(address: string): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `${address.toLowerCase()}.${expiresAt}`;
  const sig = sign(payload);
  return { token: `${payload}.${sig}`, expiresAt };
}

export function verifySessionToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [address, expiresAtStr, sig] = parts;
  const expiresAt = Number(expiresAtStr);
  if (!address || !Number.isFinite(expiresAt)) return null;
  if (Date.now() > expiresAt) return null;

  const expectedSig = sign(`${address}.${expiresAtStr}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  return address;
}

export const SESSION_COOKIE_NAME = "mastra_session";
