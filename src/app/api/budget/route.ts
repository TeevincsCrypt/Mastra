import { NextResponse } from "next/server";
import { listAutomations } from "@/lib/store/automations";
import { getPolicy } from "@/lib/store/policies";
import { sumSpentSince } from "@/lib/store/executions";

export const dynamic = "force-dynamic";

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
 * Real budget usage, derived entirely from actual persisted execution
 * records — never a separately-tracked counter that could drift from
 * what actually happened on-chain. Grouped by (fromToken), since amounts
 * are token-native, not a fabricated USD total — see store/types.ts.
 */
export async function GET() {
  const automations = await listAutomations();
  const now = Date.now();
  const byToken = new Map<string, { allocatedDaily: number; allocatedMonthly: number; spentToday: number; spentThisMonth: number; automations: number }>();

  for (const automation of automations) {
    const policy = await getPolicy(automation.policyId);
    if (!policy) continue;
    const token = automation.fromToken;
    const entry = byToken.get(token) ?? { allocatedDaily: 0, allocatedMonthly: 0, spentToday: 0, spentThisMonth: 0, automations: 0 };
    entry.allocatedDaily += Number(policy.dailyLimitAmount) || 0;
    entry.allocatedMonthly += Number(policy.monthlyLimitAmount) || 0;
    entry.spentToday += await sumSpentSince([automation.id], startOfDay(now));
    entry.spentThisMonth += await sumSpentSince([automation.id], startOfMonth(now));
    entry.automations += 1;
    byToken.set(token, entry);
  }

  return NextResponse.json({
    ok: true,
    tokens: Object.fromEntries(byToken),
    activeAutomations: automations.filter((a) => a.status === "active").length,
    totalAutomations: automations.length,
  });
}
