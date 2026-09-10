import { NextResponse } from "next/server";
import { prepareMainnetSwapWorkflow } from "@/lib/keeperhub/dynamicSwap";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Phase B endpoint: the real Wayfinder -> KeeperHub mainnet pipeline.
 * Creates a real KeeperHub workflow (approve, if the on-chain allowance is
 * insufficient, then execute) and returns it along with the computed
 * approval-hash security plan. Never calls KeeperHub's execute(workflowId)
 * — that remains a separate, later, explicitly-gated step (Phase D).
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
  const amount = body.amount ?? "1.2";

  const result = await prepareMainnetSwapWorkflow({ fromToken, toToken, amount });
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
