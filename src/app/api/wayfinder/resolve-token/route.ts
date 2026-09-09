import { NextResponse } from "next/server";
import { resolveToken, WayfinderError } from "@/lib/wayfinder/client";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Diagnostic-only route. Calls the SDK's read-only onchain_resolve_token
 * tool to surface the real HTTP status code behind a token resolution
 * failure — onchain_quote_swap's own error handling discards it. Never
 * touches signing/execution.
 */
export async function POST(request: Request) {
  let body: { query?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.query) {
    return NextResponse.json({ ok: false, error: "query is required." }, { status: 400 });
  }

  try {
    const result = await resolveToken(body.query);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    if (err instanceof WayfinderError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 502 });
    }
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown Wayfinder error." },
      { status: 500 },
    );
  }
}
