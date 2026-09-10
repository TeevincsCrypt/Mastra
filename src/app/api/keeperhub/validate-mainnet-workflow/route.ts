import { NextResponse } from "next/server";
import type { Hex } from "viem";
import { quoteSwap, WayfinderError } from "@/lib/wayfinder/client";
import { decodeExecuteCalldata, ExecuteCalldataError, isVerifiedRouter } from "@/lib/wayfinder/executeCalldata";
import {
  buildApproveAction,
  buildExecuteAction,
  buildSequentialWorkflow,
  createWorkflow,
} from "@/lib/keeperhub/dynamicWorkflow";
import { KeeperHubError } from "@/lib/keeperhub/client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Diagnostic-only, mainnet-facing but NON-EXECUTING route.
 *
 * Wayfinder's provider selection (lifi/enso/sprinter) is not fixed — it
 * picks whichever route is best at quote time, and that can change between
 * calls. Only ONE router contract has actually been verified in this
 * project (see executeCalldata.ts's VERIFIED_ROUTER_ADDRESS). A quote
 * routed through anything else produces calldata this project correctly
 * refuses to interpret, rather than guessing at an unaudited contract's
 * semantics just because its ABI shape happens to match.
 *
 * So: re-quote up to MAX_ATTEMPTS times looking for a route through the
 * verified router. If none land, report an honest "unsupported router"
 * result rather than looping forever or attempting to trust an unverified
 * contract. This is a deliberate, disclosed limitation, not a bug to route
 * around — fully verifying every possible aggregator contract (LI.FI and
 * Enso are open-ended, multi-shape systems) is its own large investigation,
 * not something to bolt on here.
 *
 * Pipeline per attempt: real Wayfinder quote (include_calldata forced true
 * in quoteSwap) -> decode the outer execute(bytes,bytes[]) call -> check
 * the router address matches the verified one -> build a KeeperHub
 * {approve, execute} workflow using the decoded bytes verbatim ->
 * POST /api/workflows/create. createWorkflow() only creates a workflow
 * object — it never calls execute(workflowId). Nothing is signed or
 * broadcast by this route under any circumstances.
 */

const MAX_ATTEMPTS = 3;

interface RequestBody {
  fromToken?: string;
  toToken?: string;
  amount?: string;
}

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const fromToken = body.fromToken ?? "usd-coin-ethereum";
  const toToken = body.toToken ?? "weth-ethereum";
  const amount = body.amount ?? "1.5";

  const attemptsLog: Array<{ attempt: number; routerAddress?: string; outcome: string }> = [];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let quote;
    try {
      quote = await quoteSwap({ fromToken, toToken, amount });
    } catch (err) {
      if (err instanceof WayfinderError) {
        return NextResponse.json(
          { ok: false, stage: "wayfinder_quote", error: err.message, attemptsLog },
          { status: 502 },
        );
      }
      return NextResponse.json(
        { ok: false, stage: "wayfinder_quote", error: err instanceof Error ? err.message : "Unknown error.", attemptsLog },
        { status: 500 },
      );
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
    const value = String(calldata.value ?? "0");

    const approveAction = buildApproveAction({
      tokenAddress,
      spender: calldata.to,
      amount: String(inputAmountRaw),
      network,
    });

    const executeAction = buildExecuteAction({
      routerAddress: calldata.to,
      commands: decoded.commands,
      inputs: decoded.inputs,
      network,
    });

    const workflowDefinition = buildSequentialWorkflow(
      `Mastra Wayfinder validation ${new Date().toISOString()}`,
      [approveAction, executeAction],
    );

    try {
      const keeperhubResponse = await createWorkflow(workflowDefinition);
      return NextResponse.json({
        ok: true,
        note: "This ONLY created a workflow object in KeeperHub — nothing was executed, signed, or broadcast.",
        attempt,
        attemptsLog,
        decoded: { commandsLength: decoded.commands.length, inputsCount: decoded.inputs.length },
        tokenAddress,
        inputAmountRaw,
        network,
        value,
        routerAddress: calldata.to,
        workflowDefinition,
        keeperhubResponse,
      });
    } catch (err) {
      if (err instanceof KeeperHubError) {
        return NextResponse.json(
          {
            ok: false,
            stage: "keeperhub_create_workflow",
            error: err.message,
            status: err.status,
            body: err.body,
            attemptsLog,
            workflowDefinitionAttempted: workflowDefinition,
          },
          { status: 502 },
        );
      }
      throw err;
    }
  }

  return NextResponse.json(
    {
      ok: false,
      stage: "unsupported_router",
      error: `None of ${MAX_ATTEMPTS} Wayfinder quotes routed through the one verified router. This is a real, disclosed limitation, not a fabricated result — only one aggregator's contract has been independently verified in this project.`,
      attemptsLog,
    },
    { status: 502 },
  );
}
