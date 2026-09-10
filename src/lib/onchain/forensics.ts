import "server-only";
import type { Hash } from "viem";
import { publicClient } from "./allowance";

/**
 * Read-only forensic analysis of a real, already-mined transaction. Every
 * call here is a plain read (eth_getTransactionByHash,
 * eth_getTransactionReceipt, a replayed eth_call at the transaction's own
 * block, and a best-effort debug_traceTransaction attempt). Nothing here
 * signs, broadcasts, or sends a transaction — there is no wallet or key
 * anywhere in this module. debug_traceTransaction is very likely
 * unsupported on the free public RPC this project uses (that namespace is
 * usually restricted to paid/archive nodes) — this is attempted and its
 * absence reported honestly rather than assumed to work.
 */

export interface ForensicsResult {
  transaction: unknown;
  receipt: unknown;
  trace: unknown;
  traceError: string | null;
  /** Error thrown by replaying the exact call at the pre-mining block state, if any — null means the replay did NOT revert (itself a fact worth reporting, not just silence). Could also be an infra error (e.g. missing archive state on a pruned public RPC) rather than a true revert reason — reported verbatim either way, not interpreted here. */
  revertReplayError: string | null;
}

function serializeBigInts(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(serializeBigInts);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, serializeBigInts(v)]));
  }
  return value;
}

export async function getTransactionForensics(hash: Hash): Promise<ForensicsResult> {
  const [tx, receipt] = await Promise.all([
    publicClient.getTransaction({ hash }),
    publicClient.getTransactionReceipt({ hash }),
  ]);

  let trace: unknown = null;
  let traceError: string | null = null;
  try {
    // debug_traceTransaction is not part of viem's typed public RPC schema
    // (it's a non-standard, node-implementation-specific method) — bypass
    // typing to attempt it anyway; failure is expected on most public RPCs
    // and handled below rather than assumed to work.
    const untypedRequest = publicClient.request as (args: { method: string; params: unknown[] }) => Promise<unknown>;
    trace = await untypedRequest({
      method: "debug_traceTransaction",
      params: [hash, { tracer: "callTracer" }],
    });
  } catch (err) {
    traceError = err instanceof Error ? err.message : String(err);
  }

  // Best-effort revert reason: replay the exact call at the block BEFORE it
  // was mined (mirrors the state the real transaction actually executed
  // against). Requires the RPC to have archive state at that block; a
  // pruned/free node may not, in which case this fails honestly with an
  // infra error rather than a true revert reason — reported verbatim, not
  // interpreted here.
  let revertReplayError: string | null = null;
  try {
    await publicClient.call({
      account: tx.from,
      to: tx.to ?? undefined,
      data: tx.input,
      value: tx.value,
      blockNumber: tx.blockNumber ? tx.blockNumber - BigInt(1) : undefined,
    });
  } catch (err) {
    revertReplayError = err instanceof Error ? err.message : String(err);
  }

  return {
    transaction: serializeBigInts(tx),
    receipt: serializeBigInts(receipt),
    trace,
    traceError,
    revertReplayError,
  };
}
