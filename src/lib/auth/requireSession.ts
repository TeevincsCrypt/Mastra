import "server-only";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "./session";

/** The real, server-side identity check. Returns the cryptographically verified wallet address behind the request's session cookie, or null. Never trust a client-supplied address field instead of this. */
export async function getAuthenticatedAddress(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

/**
 * The additional gate on top of getAuthenticatedAddress() for the
 * actually-dangerous operation: triggering a real KeeperHub execute()
 * against the shared, operator-funded execution wallet. If
 * MASTRA_AUTHORIZED_EXECUTORS is set (comma-separated addresses), only
 * those addresses may execute — anyone can still create/configure
 * automations and see everything, but only an allowlisted operator can
 * spend real funds. If unset, this is a disclosed, documented gap (see
 * README) rather than a silent one: any authenticated (signature-verified)
 * address may execute, same as the project's posture before this change.
 */
export function isAuthorizedExecutor(address: string): boolean {
  const raw = process.env.MASTRA_AUTHORIZED_EXECUTORS;
  if (!raw) return true;
  const allowlist = raw
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(address.toLowerCase());
}
