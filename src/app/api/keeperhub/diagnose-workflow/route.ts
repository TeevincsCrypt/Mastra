import { NextResponse } from "next/server";
import { getCreatedWorkflow, getWalletBalances } from "@/lib/keeperhub/dynamicWorkflow";
import { KeeperHubError } from "@/lib/keeperhub/client";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Read-only diagnostic. Calls only GET endpoints:
 *   - GET /api/workflows/{id} — re-fetches the stored workflow definition
 *     created during Phase A schema validation, to inspect workflowType,
 *     enabled, and whether anything changed since creation.
 *   - GET /api/user/wallet/balances — an attempt to discover KeeperHub's
 *     actual execution wallet address (needed for an allowance check
 *     before Phase B). Not previously confirmed; this IS the confirmation
 *     attempt.
 * Never calls execute, enable, update, or any other mutating endpoint.
 */

interface RequestBody {
  workflowId?: string;
}

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const workflowId = body.workflowId ?? "xt0w6n7m8o6u5419lz9iz";

  const result: Record<string, unknown> = { workflowId };

  try {
    result.workflow = await getCreatedWorkflow(workflowId);
  } catch (err) {
    result.workflowError =
      err instanceof KeeperHubError
        ? { message: err.message, status: err.status, body: err.body }
        : err instanceof Error
          ? err.message
          : "Unknown error fetching workflow.";
  }

  try {
    result.walletBalances = await getWalletBalances();
  } catch (err) {
    result.walletBalancesError =
      err instanceof KeeperHubError
        ? { message: err.message, status: err.status, body: err.body }
        : err instanceof Error
          ? err.message
          : "Unknown error fetching wallet balances.";
  }

  return NextResponse.json({ ok: true, note: "Read-only — no execute, enable, or update call was made.", ...result });
}
