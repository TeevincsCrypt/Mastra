import { NextResponse } from "next/server";
import { getAuthenticatedAddress, isAuthorizedExecutor } from "@/lib/auth/requireSession";
import { setPaused } from "@/lib/store/systemState";
import { recordAuditEvent } from "@/lib/store/audit";

export const dynamic = "force-dynamic";

interface Body {
  paused?: boolean;
}

/**
 * The real, server-side emergency stop toggle. Pausing is deliberately
 * easy — any signed-in wallet can pull it, since a safety valve that's
 * hard to reach isn't much of one. Un-pausing requires the same
 * operator-allowlist check as triggering an execution (if configured).
 */
export async function POST(request: Request) {
  const caller = await getAuthenticatedAddress();
  if (!caller) return NextResponse.json({ ok: false, error: "Sign in with your wallet first." }, { status: 401 });

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }
  if (typeof body.paused !== "boolean") {
    return NextResponse.json({ ok: false, error: "paused (boolean) is required." }, { status: 400 });
  }

  if (!body.paused && !isAuthorizedExecutor(caller)) {
    return NextResponse.json({ ok: false, error: "Only an authorized executor can lift the pause." }, { status: 403 });
  }

  const state = setPaused(body.paused, caller);
  recordAuditEvent({
    type: body.paused ? "SYSTEM_PAUSED" : "SYSTEM_RESUMED",
    message: body.paused ? `All automation execution paused by ${caller}.` : `Automation execution resumed by ${caller}.`,
  });
  return NextResponse.json({ ok: true, ...state });
}
