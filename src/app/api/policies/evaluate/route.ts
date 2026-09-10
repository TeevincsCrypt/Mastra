import { NextResponse } from "next/server";
import { getPolicy } from "@/lib/store/policies";
import { sumSpentSince } from "@/lib/store/executions";
import { evaluatePolicy } from "@/lib/policy/evaluate";
import { VERIFIED_ROUTER_ADDRESS } from "@/lib/wayfinder/executeCalldata";

export const dynamic = "force-dynamic";

interface Body {
  policyId?: string;
  automationId?: string;
  chainId?: string;
  fromToken?: string;
  toToken?: string;
  amount?: string;
  routerAddress?: string;
  slippageBps?: number;
}

function startOfDay(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function startOfMonth(now: number): number {
  const d = new Date(now);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Standalone policy-evaluation diagnostic — exposes the exact same
 * deterministic evaluatePolicy() function runAutomationExecution uses,
 * so a policy can be tested against a hypothetical proposal without
 * triggering a real Wayfinder quote or touching KeeperHub. Used by the
 * Policies page's "test this policy" panel.
 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.policyId || !body.fromToken || !body.toToken || !body.amount) {
    return NextResponse.json({ ok: false, error: "policyId, fromToken, toToken and amount are required." }, { status: 400 });
  }

  const policy = await getPolicy(body.policyId);
  if (!policy) return NextResponse.json({ ok: false, error: "Policy not found." }, { status: 404 });

  const now = Date.now();
  const automationIds = body.automationId ? [body.automationId] : [];

  const decision = evaluatePolicy({
    policy,
    chainId: body.chainId ?? "1",
    fromToken: body.fromToken,
    toToken: body.toToken,
    amount: body.amount,
    routerAddress: body.routerAddress ?? VERIFIED_ROUTER_ADDRESS,
    slippageBps: body.slippageBps ?? 50,
    quoteFetchedAt: now,
    spentTodayAmount: automationIds.length ? await sumSpentSince(automationIds, startOfDay(now)) : 0,
    spentThisMonthAmount: automationIds.length ? await sumSpentSince(automationIds, startOfMonth(now)) : 0,
  });

  return NextResponse.json({ ok: true, decision });
}
