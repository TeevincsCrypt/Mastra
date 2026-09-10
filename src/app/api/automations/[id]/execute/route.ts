import { NextResponse } from "next/server";
import { getAuthenticatedAddress, isAuthorizedExecutor } from "@/lib/auth/requireSession";
import { getAutomation } from "@/lib/store/automations";
import { runAutomationExecution } from "@/lib/policy/runAutomationExecution";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

/**
 * The one route in this project allowed to trigger a real KeeperHub
 * execute() through the policy engine. Every gate below runs before
 * Wayfinder or KeeperHub are ever touched: real signature-verified
 * session -> ownership check -> operator allowlist (if configured) ->
 * system-wide pause flag (checked again, authoritatively, inside
 * runAutomationExecution). A request that fails any of these never
 * reaches prepareMainnetSwapWorkflow.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getAuthenticatedAddress();
  if (!caller) {
    return NextResponse.json({ ok: false, error: "Sign in with your wallet first." }, { status: 401 });
  }

  const { id } = await params;
  const automation = getAutomation(id);
  if (!automation) {
    return NextResponse.json({ ok: false, error: "Automation not found." }, { status: 404 });
  }
  if (automation.ownerAddress.toLowerCase() !== caller.toLowerCase()) {
    return NextResponse.json({ ok: false, error: "Only the automation's creator can execute it." }, { status: 403 });
  }
  if (!isAuthorizedExecutor(caller)) {
    return NextResponse.json(
      { ok: false, error: "This address is not on the authorized-executor list configured for this deployment." },
      { status: 403 },
    );
  }

  try {
    const execution = await runAutomationExecution(id, caller);
    return NextResponse.json({ ok: execution.status === "success", execution }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error running the automation." },
      { status: 500 },
    );
  }
}
