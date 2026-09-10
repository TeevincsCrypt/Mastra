import { NextResponse } from "next/server";
import { executeMainnetSwapWorkflow } from "@/lib/keeperhub/dynamicSwap";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

/**
 * Phase D. The ONLY route in this project that calls KeeperHub's real
 * execute(workflowId) for the mainnet Wayfinder path. Requires both a
 * workflowId and the approvedHash returned when that workflow was
 * prepared — the hash is re-verified against what's actually stored in
 * KeeperHub right now before anything is called. A mismatch refuses to
 * execute rather than proceeding.
 *
 * This sends real transactions and spends real funds when it succeeds.
 */

interface RequestBody {
  workflowId?: string;
  approvedHash?: string;
}

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.workflowId || !body.approvedHash) {
    return NextResponse.json({ ok: false, error: "workflowId and approvedHash are both required." }, { status: 400 });
  }

  const result = await executeMainnetSwapWorkflow({ workflowId: body.workflowId, approvedHash: body.approvedHash });
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
