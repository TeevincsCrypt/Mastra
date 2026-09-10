import { NextResponse } from "next/server";
import { getAuthenticatedAddress } from "@/lib/auth/requireSession";
import { getAutomation, updateAutomation } from "@/lib/store/automations";
import { recordAuditEvent } from "@/lib/store/audit";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getAuthenticatedAddress();
  if (!caller) return NextResponse.json({ ok: false, error: "Sign in with your wallet first." }, { status: 401 });

  const { id } = await params;
  const automation = getAutomation(id);
  if (!automation) return NextResponse.json({ ok: false, error: "Automation not found." }, { status: 404 });
  if (automation.ownerAddress.toLowerCase() !== caller.toLowerCase()) {
    return NextResponse.json({ ok: false, error: "Only the automation's creator can activate it." }, { status: 403 });
  }

  const updated = updateAutomation(id, { status: "active" });
  recordAuditEvent({ automationId: id, type: "AUTOMATION_ACTIVATED", message: `Activated by ${caller}.` });
  return NextResponse.json({ ok: true, automation: updated });
}
