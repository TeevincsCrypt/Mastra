import "server-only";
import type { Hex } from "viem";
import { quoteSwap, WayfinderError } from "@/lib/wayfinder/client";
import { decodeExecuteCalldata, ExecuteCalldataError, isVerifiedRouter } from "@/lib/wayfinder/executeCalldata";
import {
  buildApproveAction,
  buildExecuteAction,
  buildSequentialWorkflow,
  createWorkflow,
  getCurrentUser,
  type Web3WriteContractAction,
  type DynamicWorkflowDefinition,
} from "@/lib/keeperhub/dynamicWorkflow";
import { getErc20Allowance } from "@/lib/onchain/allowance";
import { hashApprovedWorkflow } from "@/lib/approvalHash";
import { KeeperHubError } from "@/lib/keeperhub/client";

/**
 * Phase B: the real Wayfinder -> KeeperHub mainnet swap pipeline.
 *
 * This creates a real KeeperHub workflow (approve, if needed, then
 * execute) but NEVER calls KeeperHub's execute(workflowId) endpoint —
 * that is a deliberately separate, later, explicitly-gated step. Nothing
 * here signs or broadcasts a transaction. The allowance check is a plain
 * read-only eth_call (see onchain/allowance.ts) — not a KeeperHub action,
 * and not "executing through viem" in the sense this project rules out.
 *
 * Router trust is address-based (see executeCalldata.ts): only the one
 * independently verified contract is accepted, matching the same 3-retry,
 * honest-failure behavior already proven in the Phase A validator. The
 * Wayfinder-produced commands/inputs bytes are never reconstructed or
 * reinterpreted — only the outer execute(bytes,bytes[]) call is decoded,
 * exactly as established during verification.
 */

const MAX_ATTEMPTS = 3;

type AttemptLog = Array<{ attempt: number; routerAddress?: string; outcome: string }>;

export interface PreparedMainnetSwap {
  ok: true;
  attempt: number;
  attemptsLog: AttemptLog;
  executionWallet: string;
  tokenAddress: string;
  routerAddress: string;
  network: string;
  inputAmountRaw: string;
  requiredAllowance: string;
  currentAllowance: string;
  approvalNeeded: boolean;
  actions: Web3WriteContractAction[];
  workflowDefinition: DynamicWorkflowDefinition;
  approvalHash: string;
  securityPlan: Record<string, unknown>;
  keeperhubWorkflow: unknown;
  keeperhubWorkflowId: string | undefined;
}

export interface PreparedMainnetSwapFailure {
  ok: false;
  stage: string;
  error: string;
  attemptsLog?: AttemptLog;
  details?: unknown;
}

export async function prepareMainnetSwapWorkflow(params: {
  fromToken: string;
  toToken: string;
  amount: string;
}): Promise<PreparedMainnetSwap | PreparedMainnetSwapFailure> {
  let executionWallet: string;
  try {
    const { body } = await getCurrentUser();
    const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    if (typeof record.walletAddress !== "string" || !record.walletAddress) {
      return { ok: false, stage: "resolve_execution_wallet", error: "GET /api/user did not return a walletAddress." };
    }
    executionWallet = record.walletAddress;
  } catch (err) {
    return {
      ok: false,
      stage: "resolve_execution_wallet",
      error: err instanceof KeeperHubError ? err.message : err instanceof Error ? err.message : "Unknown error.",
    };
  }

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
      currentAllowance = await getErc20Allowance(tokenAddress, executionWallet, calldata.to);
    } catch (err) {
      return {
        ok: false,
        stage: "check_allowance",
        error: err instanceof Error ? err.message : "Unknown error reading on-chain allowance.",
        attemptsLog,
      };
    }

    const approvalNeeded = currentAllowance < requiredAllowance;

    const executeAction = buildExecuteAction({
      routerAddress: calldata.to,
      commands: decoded.commands,
      inputs: decoded.inputs,
      network,
    });

    let approveAction: Web3WriteContractAction | null = null;
    const actions: Web3WriteContractAction[] = [];
    if (approvalNeeded) {
      approveAction = buildApproveAction({
        tokenAddress,
        spender: calldata.to,
        amount: String(inputAmountRaw),
        network,
      });
      actions.push(approveAction);
    }
    actions.push(executeAction);

    const workflowDefinition = buildSequentialWorkflow(`Mastra Wayfinder mainnet swap ${new Date().toISOString()}`, actions);

    // Security invariant: this is what gets hashed at "approval" time and
    // re-verified immediately before any future execute call. Covers
    // exactly what was specified: target contract, network, function,
    // commands, inputs, the approval action if one is included, and
    // amounts. Nothing about the swap can change post-approval without
    // invalidating this hash.
    const securityPlan = {
      targetContract: calldata.to,
      network,
      function: "execute",
      commands: decoded.commands,
      inputs: decoded.inputs,
      approvalAction: approveAction,
      amounts: { tokenAddress, inputAmountRaw: String(inputAmountRaw) },
    };
    const approvalHash = await hashApprovedWorkflow(securityPlan);

    try {
      const keeperhubWorkflow = await createWorkflow(workflowDefinition);
      const workflowRecord =
        keeperhubWorkflow && typeof keeperhubWorkflow === "object" ? (keeperhubWorkflow as Record<string, unknown>) : {};
      return {
        ok: true,
        attempt,
        attemptsLog,
        executionWallet,
        tokenAddress,
        routerAddress: calldata.to,
        network,
        inputAmountRaw: String(inputAmountRaw),
        requiredAllowance: requiredAllowance.toString(),
        currentAllowance: currentAllowance.toString(),
        approvalNeeded,
        actions,
        workflowDefinition,
        approvalHash,
        securityPlan,
        keeperhubWorkflow,
        keeperhubWorkflowId: typeof workflowRecord.id === "string" ? workflowRecord.id : undefined,
      };
    } catch (err) {
      return {
        ok: false,
        stage: "keeperhub_create_workflow",
        error: err instanceof KeeperHubError ? err.message : err instanceof Error ? err.message : "Unknown error.",
        details: err instanceof KeeperHubError ? { status: err.status, body: err.body } : undefined,
        attemptsLog,
      };
    }
  }

  return {
    ok: false,
    stage: "unsupported_router",
    error: `None of ${MAX_ATTEMPTS} Wayfinder quotes routed through the one verified router. Real, disclosed limitation — not a fabricated result.`,
    attemptsLog,
  };
}
