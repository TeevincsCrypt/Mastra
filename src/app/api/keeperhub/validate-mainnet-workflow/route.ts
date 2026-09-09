import { NextResponse } from "next/server";
import type { Hex } from "viem";
import { quoteSwap, WayfinderError } from "@/lib/wayfinder/client";
import { decodeExecuteCalldata, ExecuteCalldataError } from "@/lib/wayfinder/executeCalldata";
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
 * Pipeline: real Wayfinder quote (include_calldata already forced true in
 * quoteSwap) -> decode the outer execute(bytes,bytes[]) call -> build a
 * KeeperHub {approve, execute} workflow definition using the decoded bytes
 * verbatim -> POST /api/workflows/create.
 *
 * createWorkflow() only creates a workflow object in KeeperHub — it is a
 * distinct, separate call from execute(workflowId), which this route never
 * calls. Nothing is signed or broadcast by this route under any
 * circumstances. Its entire purpose is answering one question empirically:
 * does KeeperHub's write-contract schema accept bytes/bytes[] functionArgs
 * and a payable execute() with value.
 */

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

  let quote;
  try {
    quote = await quoteSwap({ fromToken, toToken, amount });
  } catch (err) {
    if (err instanceof WayfinderError) {
      return NextResponse.json({ ok: false, stage: "wayfinder_quote", error: err.message }, { status: 502 });
    }
    return NextResponse.json(
      { ok: false, stage: "wayfinder_quote", error: err instanceof Error ? err.message : "Unknown error." },
      { status: 500 },
    );
  }

  const raw = quote.raw as Record<string, unknown>;
  const result = (raw.result ?? raw) as Record<string, unknown>;
  const executionQuote = result.execution_quote as Record<string, unknown> | undefined;
  const calldata = executionQuote?.calldata as Record<string, unknown> | undefined;

  if (!calldata || typeof calldata.data !== "string" || typeof calldata.to !== "string") {
    return NextResponse.json(
      {
        ok: false,
        stage: "extract_calldata",
        error: "Wayfinder response did not include execution_quote.calldata.{to,data} — nothing to decode.",
        raw,
      },
      { status: 502 },
    );
  }

  let decoded;
  try {
    decoded = decodeExecuteCalldata(calldata.data as Hex);
  } catch (err) {
    if (err instanceof ExecuteCalldataError) {
      return NextResponse.json({ ok: false, stage: "decode_execute", error: err.message, calldata }, { status: 502 });
    }
    throw err;
  }

  const suggested = result.suggested_swap_request as Record<string, unknown> | undefined;
  const fromTokenId = typeof suggested?.from_token === "string" ? suggested.from_token : undefined;
  const tokenAddress = fromTokenId?.includes("_") ? fromTokenId.split("_").slice(1).join("_") : undefined;
  const inputAmountRaw = executionQuote?.input_amount;

  if (!tokenAddress || (typeof inputAmountRaw !== "number" && typeof inputAmountRaw !== "string")) {
    return NextResponse.json(
      {
        ok: false,
        stage: "extract_approval_params",
        error: "Could not determine the input token address or raw input amount from the quote response.",
        suggested,
        executionQuote,
      },
      { status: 502 },
    );
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
    value,
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
          workflowDefinitionAttempted: workflowDefinition,
        },
        { status: 502 },
      );
    }
    throw err;
  }
}
