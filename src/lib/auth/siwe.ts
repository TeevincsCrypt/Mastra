import "server-only";
import { verifyMessage, isAddress } from "viem";

/**
 * Minimal sign-in-with-wallet message + verification. Deliberately avoids
 * needing a server-side nonce store (no database for this project) by
 * embedding a timestamp in the message itself and rejecting anything
 * outside a short freshness window — a real, verifiable signature check,
 * with one disclosed tradeoff versus a full nonce-tracked SIWE
 * implementation: a signature is technically replayable within that
 * window rather than exactly once. Documented in README "Known
 * limitations" — a production version should track used nonces.
 */

const FRESHNESS_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export function buildChallengeMessage(address: string, issuedAt: number): string {
  return [
    "Mastra wants you to authorize automation actions on this account.",
    "",
    `Address: ${address}`,
    `Issued: ${new Date(issuedAt).toISOString()}`,
    "",
    "This signature does not send a transaction or cost gas.",
  ].join("\n");
}

export async function verifyChallengeSignature(params: {
  address: string;
  message: string;
  signature: `0x${string}`;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isAddress(params.address)) {
    return { ok: false, error: "Invalid address." };
  }

  const issuedMatch = params.message.match(/^Issued: (.+)$/m);
  const addressMatch = params.message.match(/^Address: (.+)$/m);
  if (!issuedMatch || !addressMatch) {
    return { ok: false, error: "Message does not match the expected challenge format." };
  }
  if (addressMatch[1].toLowerCase() !== params.address.toLowerCase()) {
    return { ok: false, error: "Message address does not match the claimed signer." };
  }

  const issuedAt = new Date(issuedMatch[1]).getTime();
  if (!Number.isFinite(issuedAt) || Math.abs(Date.now() - issuedAt) > FRESHNESS_WINDOW_MS) {
    return { ok: false, error: "Challenge has expired — request a new one and sign again." };
  }

  const expected = buildChallengeMessage(params.address, issuedAt);
  if (expected !== params.message) {
    return { ok: false, error: "Message content does not match the expected challenge template." };
  }

  let valid: boolean;
  try {
    valid = await verifyMessage({
      address: params.address as `0x${string}`,
      message: params.message,
      signature: params.signature,
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Signature verification failed." };
  }

  if (!valid) return { ok: false, error: "Signature does not match the claimed address." };
  return { ok: true };
}
