import { NextResponse } from "next/server";
import { listAuditEvents } from "@/lib/store/audit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const automationId = url.searchParams.get("automationId") ?? undefined;
  const executionId = url.searchParams.get("executionId") ?? undefined;
  return NextResponse.json({ ok: true, events: listAuditEvents({ automationId, executionId }) });
}
