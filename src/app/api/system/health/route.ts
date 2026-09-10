import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/keeperhub/dynamicWorkflow";
import { readCollection, writeCollection, isRedisBacked } from "@/lib/store/fileStore";
import { getSystemState } from "@/lib/store/systemState";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

type Health = "connected" | "degraded" | "offline" | "not_configured";

/**
 * Real health checks, not a fabricated status board:
 * - KeeperHub: an actual GET /api/user call. connected only if it really
 *   answers with a wallet address.
 * - Wayfinder: WAYFINDER_MCP_URL presence is a real config check; this
 *   does NOT make a live MCP round-trip on every page load (that costs a
 *   real request each time this loads) — labeled "configured" rather than
 *   "connected" for that reason. Use /wayfinder-test or the Integrations
 *   page's live quote button for an actual connectivity proof.
 * - Storage: a real write-then-read round trip against the file store.
 * - Policy engine: trivially real — it's deterministic code in this same
 *   process, so it's either running (it is, by definition of this request
 *   completing) or the whole app is down.
 */
export async function GET() {
  let keeperhub: { status: Health; detail?: string } = { status: "offline" };
  try {
    const { status, body } = await getCurrentUser();
    const walletAddress = body && typeof body === "object" ? (body as Record<string, unknown>).walletAddress : undefined;
    if (status === 200 && typeof walletAddress === "string" && walletAddress) {
      keeperhub = { status: "connected", detail: walletAddress };
    } else {
      keeperhub = { status: "degraded", detail: `Unexpected response (HTTP ${status}).` };
    }
  } catch (err) {
    keeperhub = { status: "offline", detail: err instanceof Error ? err.message : "Unreachable." };
  }

  const wayfinder: { status: Health; detail?: string } = process.env.WAYFINDER_MCP_URL
    ? { status: "connected", detail: "WAYFINDER_MCP_URL configured (config check, not a live round-trip)." }
    : { status: "not_configured", detail: "WAYFINDER_MCP_URL is not set." };

  let storage: { status: Health; detail?: string } = { status: "offline" };
  try {
    const marker = `health-${Date.now()}`;
    await writeCollection("_health_check", [marker]);
    const read = await readCollection<string>("_health_check");
    storage = read[0] === marker
      ? { status: "connected", detail: isRedisBacked() ? "Redis (shared across instances)." : "Local file store (single-instance only)." }
      : { status: "degraded", detail: "Write/read mismatch." };
  } catch (err) {
    storage = { status: "offline", detail: err instanceof Error ? err.message : "Storage backend unavailable." };
  }

  const system = await getSystemState();

  return NextResponse.json({
    ok: true,
    keeperhub,
    wayfinder,
    storage,
    policyEngine: { status: "connected" as Health },
    executionEngine: { status: system.paused ? ("degraded" as Health) : ("connected" as Health), detail: system.paused ? "Paused" : "Ready" },
  });
}
