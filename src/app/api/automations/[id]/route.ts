import { NextResponse } from "next/server";
import { getAutomation } from "@/lib/store/automations";
import { getPolicy } from "@/lib/store/policies";
import { listExecutions } from "@/lib/store/executions";
import { listAuditEvents } from "@/lib/store/audit";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const automation = await getAutomation(id);
  if (!automation) {
    return NextResponse.json({ ok: false, error: "Automation not found." }, { status: 404 });
  }
  const [policy, executions, auditEvents] = await Promise.all([
    getPolicy(automation.policyId),
    listExecutions(id),
    listAuditEvents({ automationId: id }),
  ]);
  return NextResponse.json({ ok: true, automation, policy, executions, auditEvents });
}
