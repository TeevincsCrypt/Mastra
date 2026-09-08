import { NextResponse } from "next/server";
import { getWorkflow, KeeperHubError } from "@/lib/keeperhub/client";

export const dynamic = "force-dynamic";

/**
 * Real KeeperHub "preflight" — not a transaction simulation (KeeperHub's
 * documented API doesn't expose one), but a genuine GET confirming the
 * configured workflow exists, is reachable with this API key, and reports
 * back what chain it targets. See src/lib/types.ts for why this is named
 * "preflight" rather than "simulation".
 */
export async function GET() {
  const workflowId = process.env.KEEPERHUB_WORKFLOW_ID;
  if (!workflowId) {
    return NextResponse.json(
      { ok: false, error: "KEEPERHUB_WORKFLOW_ID is not configured on the server." },
      { status: 500 },
    );
  }

  try {
    const workflow = await getWorkflow(workflowId);
    return NextResponse.json({
      ok: true,
      workflow: {
        id: workflow.id ?? workflowId,
        name: typeof workflow.name === "string" ? workflow.name : undefined,
        chain: typeof workflow.chain === "string" ? workflow.chain : undefined,
      },
    });
  } catch (err) {
    if (err instanceof KeeperHubError) {
      return NextResponse.json(
        { ok: false, error: err.message, keeperhubStatus: err.status, keeperhubBody: err.body },
        { status: err.status === 0 ? 502 : 502 },
      );
    }
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown preflight error." },
      { status: 500 },
    );
  }
}
