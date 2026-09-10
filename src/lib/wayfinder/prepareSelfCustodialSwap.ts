import "server-only";
import type { Hex } from "viem";
import { quoteSwap, WayfinderError } from "./client";
import { decodeExecuteCalldata, ExecuteCalldataError, isVerifiedRouter } from "./executeCalldata";
import { getErc20Allowance } from "@/lib/onchain/allowance";

/**
 * Self-custodial swap preparation: real Wayfinder quote -> decode -> verify
 * the target router against the allowlist -> read the CONNECTED WALLET's
 * real on-chain allowance. No KeeperHub workflow is created, no server-side
 * wallet is involved — this only produces what the visitor's own wallet
 * needs to review and sign directly. Same 3-attempt verified-router retry
 * as the KeeperHub path (Wayfinder's provider selection is non-deterministic
 * and not every provider's router has been independently verified).
 */

const MAX_ATTEMPTS = 3;

type AttemptLog = Array<{ attempt: number; routerAddress?: string; outcome: string }>;

export interface PreparedSelfCustodialSwap {
  ok: true;
  attempt: number;
  attemptsLog: AttemptLog;
  tokenAddress: string;
  routerAddress: string;
  network: string;
  inputAmountRaw: string;
  requiredAllowance: string;
  currentAllowance: string;
  approvalNeeded: boolean;
  commands: Hex;
  inputs: Hex[];
}

export interface PreparedSelfCustodialSwapFailure {
  ok: false;
  stage: string;
  error: string;
  attemptsLog?: AttemptLog;
}

export async function prepareSelfCustodialSwap(params: {
  fromToken: string;
  toToken: string;
  amount: string;
  walletAddress: string;
}): Promise<PreparedSelfCustodialSwap | PreparedSelfCustodialSwapFailure> {
  const attemptsLog: AttemptLog = [];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let quote;
    try {
      quote = await quoteSwap(params);
    } catch (err) {
      return {
        ok: false,
        stage: "wayfinder_quote",
        error: err instanceof WayfinderError ? err.message : err instanceof Error ? err.message : "Unknown error.",
        attemptsLog,
      };
    }

    const raw = quote.raw as Record<string, unknown>;
    const result = (raw.result ?? raw) as Record<string, unknown>;
    const executionQuote = result.execution_quote as Record<string, unknown> | undefined;
    const calldata = executionQuote?.calldata as Record<string, unknown> | undefined;

    if (!calldata || typeof calldata.data !== "string" || typeof calldata.to !== "string") {
      attemptsLog.push({ attempt, outcome: "no execution_quote.calldata in response" });
      continue;
    }

    if (!isVerifiedRouter(calldata.to)) {
      attemptsLog.push({ attempt, routerAddress: calldata.to, outcome: "router not verified — skipping" });
      continue;
    }

    let decoded;
    try {
      decoded = decodeExecuteCalldata(calldata.data as Hex);
    } catch (err) {
      const message = err instanceof ExecuteCalldataError ? err.message : err instanceof Error ? err.message : String(err);
      attemptsLog.push({ attempt, routerAddress: calldata.to, outcome: `verified router but decode failed: ${message}` });
      continue;
    }

    const suggested = result.suggested_swap_request as Record<string, unknown> | undefined;
    const fromTokenId = typeof suggested?.from_token === "string" ? suggested.from_token : undefined;
    const tokenAddress = fromTokenId?.includes("_") ? fromTokenId.split("_").slice(1).join("_") : undefined;
    const inputAmountRaw = executionQuote?.input_amount;

    if (!tokenAddress || (typeof inputAmountRaw !== "number" && typeof inputAmountRaw !== "string")) {
      attemptsLog.push({ attempt, routerAddress: calldata.to, outcome: "could not extract token address / input amount" });
      continue;
    }

    const network = String(calldata.chainId ?? "1");
    const requiredAllowance = BigInt(String(inputAmountRaw));

    let currentAllowance: bigint;
    try {
      currentAllowance = await getErc20Allowance(tokenAddress, params.walletAddress, calldata.to);
    } catch (err) {
      return {
        ok: false,
        stage: "check_allowance",
        error: err instanceof Error ? err.message : "Unknown error reading on-chain allowance.",
        attemptsLog,
      };
    }

    return {
      ok: true,
      attempt,
      attemptsLog,
      tokenAddress,
      routerAddress: calldata.to,
      network,
      inputAmountRaw: String(inputAmountRaw),
      requiredAllowance: requiredAllowance.toString(),
      currentAllowance: currentAllowance.toString(),
      approvalNeeded: currentAllowance < requiredAllowance,
      commands: decoded.commands,
      inputs: decoded.inputs,
    };
  }

  return {
    ok: false,
    stage: "unsupported_router",
    error: `None of ${MAX_ATTEMPTS} Wayfinder quotes routed through the one verified router. Real, disclosed limitation — not a fabricated result.`,
    attemptsLog,
  };
}
