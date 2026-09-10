import "server-only";
import { decodeAbiParameters, parseAbiParameters, type Hex } from "viem";
import { quoteSwap, WayfinderError } from "@/lib/wayfinder/client";
import { decodeExecuteCalldata, ExecuteCalldataError, isVerifiedRouter } from "@/lib/wayfinder/executeCalldata";
import {
  buildApproveAction,
  buildExecuteAction,
  buildSequentialWorkflow,
  createWorkflow,
  getCreatedWorkflow,
  getCurrentUser,
  type Web3WriteContractAction,
  type DynamicWorkflowDefinition,
} from "@/lib/keeperhub/dynamicWorkflow";
import { getErc20Allowance } from "@/lib/onchain/allowance";
import { hashApprovedWorkflow } from "@/lib/approvalHash";
import {
  KeeperHubError,
  executeWorkflow,
  findExecution,
  isTerminalSuccess,
  isTerminalFailure,
} from "@/lib/keeperhub/client";

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

interface ReconstructedPlan {
  approvalAction: Web3WriteContractAction | null;
  executeAction: Web3WriteContractAction;
  securityPlan: Record<string, unknown>;
}

/**
 * Rebuilds the exact security-plan object from what's ACTUALLY persisted in
 * KeeperHub for a given workflow right now — NOT from a fresh Wayfinder
 * quote, which is never reproducible byte-for-byte (each quote embeds a
 * fresh requestId and time-sensitive routing data, so it would never match
 * even when nothing is wrong). This checks the real invariant: has the
 * workflow's stored definition been tampered with since it was approved.
 *
 * tokenAddress/inputAmountRaw are decoded directly from the execute
 * action's own first input (always the TRANSFER_FROM command's
 * (address,address,uint256) encoding, confirmed across every real quote
 * seen in this project) rather than read from the approve action, so this
 * works whether or not an approval step was included.
 */
function reconstructSecurityPlanFromWorkflow(workflow: Record<string, unknown>): ReconstructedPlan {
  const nodes = Array.isArray(workflow.nodes) ? (workflow.nodes as Array<Record<string, unknown>>) : [];
  const actionConfigs = nodes
    .filter((n) => n.type === "action")
    .map((n) => {
      const data = n.data as Record<string, unknown> | undefined;
      return data?.config as Web3WriteContractAction | undefined;
    })
    .filter((c): c is Web3WriteContractAction => !!c);

  const executeAction = actionConfigs.find((a) => a.abiFunction === "execute");
  if (!executeAction) {
    throw new Error("Stored workflow has no execute() action — cannot reconstruct security plan.");
  }
  const approvalAction = actionConfigs.find((a) => a.abiFunction === "approve") ?? null;

  const [commands, inputs] = JSON.parse(executeAction.functionArgs) as [string, string[]];
  const [tokenAddress, , inputAmountRaw] = decodeAbiParameters(
    parseAbiParameters("address, address, uint256"),
    inputs[0] as Hex,
  );

  const securityPlan = {
    targetContract: executeAction.contractAddress,
    network: executeAction.network,
    function: "execute",
    commands,
    inputs,
    approvalAction,
    amounts: { tokenAddress, inputAmountRaw: inputAmountRaw.toString() },
  };

  return { approvalAction, executeAction, securityPlan };
}

export interface ExecutedMainnetSwap {
  ok: true;
  workflowId: string;
  executionId: string;
  status: string;
  transactionHashes?: string[];
  raw: unknown;
}

export interface ExecutedMainnetSwapFailure {
  ok: false;
  stage: string;
  error: string;
  details?: unknown;
}

function delayMs(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The guarded execute step — the only place in this project that calls
 * KeeperHub's real execute(workflowId) for the mainnet Wayfinder path.
 *
 * Re-derives the security plan from what's actually stored in KeeperHub
 * right now, recomputes its hash, and refuses to call execute() if it
 * doesn't match the approvedHash the caller supplies. Only on a match does
 * this call the real, unmodified executeWorkflow() from client.ts, then
 * polls for a terminal status using client.ts's existing
 * findExecution/isTerminalSuccess/isTerminalFailure — the same pattern
 * already proven on the verified Sepolia path.
 */
export async function executeMainnetSwapWorkflow(params: {
  workflowId: string;
  approvedHash: string;
}): Promise<ExecutedMainnetSwap | ExecutedMainnetSwapFailure> {
  let workflow: unknown;
  try {
    workflow = await getCreatedWorkflow(params.workflowId);
  } catch (err) {
    return {
      ok: false,
      stage: "fetch_workflow",
      error: err instanceof KeeperHubError ? err.message : err instanceof Error ? err.message : "Unknown error.",
    };
  }

  const record = workflow && typeof workflow === "object" ? (workflow as Record<string, unknown>) : {};

  let reconstructed: ReconstructedPlan;
  try {
    reconstructed = reconstructSecurityPlanFromWorkflow(record);
  } catch (err) {
    return {
      ok: false,
      stage: "reconstruct_security_plan",
      error: err instanceof Error ? err.message : "Unknown error reconstructing the security plan.",
    };
  }

  const currentHash = await hashApprovedWorkflow(reconstructed.securityPlan);
  if (currentHash !== params.approvedHash) {
    return {
      ok: false,
      stage: "approval_invalidated",
      error: "APPROVAL INVALIDATED — the workflow's stored actions no longer match the approved hash. Refusing to execute.",
      details: { expected: params.approvedHash, actual: currentHash, securityPlan: reconstructed.securityPlan },
    };
  }

  let execResult: { executionId: string; raw: unknown };
  try {
    execResult = await executeWorkflow(params.workflowId);
  } catch (err) {
    return {
      ok: false,
      stage: "keeperhub_execute",
      error: err instanceof KeeperHubError ? err.message : err instanceof Error ? err.message : "Unknown error.",
      details: err instanceof KeeperHubError ? { status: err.status, body: err.body } : undefined,
    };
  }

  const maxPolls = 20;
  let execution;
  for (let i = 0; i < maxPolls; i++) {
    try {
      execution = await findExecution(params.workflowId, execResult.executionId);
    } catch {
      execution = undefined;
    }
    if (execution && (isTerminalSuccess(execution.status) || isTerminalFailure(execution.status))) break;
    await delayMs(3000);
  }

  if (!execution) {
    return {
      ok: false,
      stage: "poll_timeout",
      error: "Execution was triggered but did not reach a terminal state within the polling window.",
      details: { executionId: execResult.executionId },
    };
  }

  return {
    ok: true,
    workflowId: params.workflowId,
    executionId: execResult.executionId,
    status: execution.status,
    transactionHashes: execution.transactionHashes,
    raw: execution,
  };
}
