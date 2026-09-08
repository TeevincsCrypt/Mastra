import { NextResponse } from "next/server";
import { getWorkflow, resolveWorkflowId, KeeperHubError } from "@/lib/keeperhub/client";

export const dynamic = "force-dynamic";

/**
 * Real KeeperHub "preflight" — not a transaction simulation (KeeperHub's
 * documented API doesn't expose one), but a genuine GET confirming the
 * configured workflow exists, is reachable with this API key, and reports
 * back what chain it targets. See src/lib/types.ts for why this is named
 * "preflight" rather than "simulation".
 */
export async function GET() {
  try {
    const { workflowId } = await resolveWorkflowId();
    // Always fetch full detail by id — the list endpoint used for discovery
    // may only return a summary, and preflight needs the real configuration.
    const workflow = await getWorkflow(workflowId);
    const chain = firstStringField(workflow, ["chain", "network", "targetChain"]);
    return NextResponse.json({
      ok: true,
      workflow: {
        id: typeof workflow.id === "string" ? workflow.id : workflowId,
        name: typeof workflow.name === "string" ? workflow.name : undefined,
        chain,
      },
      // Full raw KeeperHub response — field names beyond id/name/chain
      // aren't confirmed against documentation, so this is exposed rather
      // than guessed at and hidden.
      raw: workflow,
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

function firstStringField(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const v = record[key];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}
