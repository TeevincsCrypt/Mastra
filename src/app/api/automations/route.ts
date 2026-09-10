import { NextResponse } from "next/server";
import { getAuthenticatedAddress } from "@/lib/auth/requireSession";
import { listAutomations, createAutomation, updateAutomation } from "@/lib/store/automations";
import { createPolicy, DEFAULT_POLICY_DEFAULTS } from "@/lib/store/policies";
import { recordAuditEvent } from "@/lib/store/audit";
import type { AutomationType } from "@/lib/store/types";

export const dynamic = "force-dynamic";

export async function GET() {
  // Read-only — visible to anyone viewing the demo, no funds at risk.
  return NextResponse.json({ ok: true, automations: listAutomations() });
}

interface CreateBody {
  name?: string;
  description?: string;
  type?: AutomationType;
  fromToken?: string;
  toToken?: string;
  amount?: string;
  frequency?: "one-time" | "weekly" | "daily" | "manual";
  triggerDescription?: string;
  triggerLive?: boolean;
  policy?: {
    maxExecutionAmount?: string;
    dailyLimitAmount?: string;
    monthlyLimitAmount?: string;
    maxSlippageBps?: number;
  };
}

export async function POST(request: Request) {
  const caller = await getAuthenticatedAddress();
  if (!caller) {
    return NextResponse.json({ ok: false, error: "Sign in with your wallet to create an automation." }, { status: 401 });
  }

  let body: CreateBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.name || !body.fromToken || !body.toToken || !body.amount) {
    return NextResponse.json({ ok: false, error: "name, fromToken, toToken and amount are required." }, { status: 400 });
  }

  try {
    const automation = createAutomation({
      ownerAddress: caller,
      name: body.name,
      description: body.description ?? "",
      type: body.type ?? "custom",
      status: "policy_review",
      fromToken: body.fromToken,
      toToken: body.toToken,
      amount: body.amount,
      frequency: body.frequency ?? "manual",
      triggerDescription: body.triggerDescription ?? "Manually triggered from the Execution Center.",
      triggerLive: body.triggerLive ?? true,
      policyId: "", // set below once the policy exists
    });

    const policy = createPolicy({
      automationId: automation.id,
      maxExecutionAmount: body.policy?.maxExecutionAmount ?? body.amount,
      dailyLimitAmount: body.policy?.dailyLimitAmount ?? body.amount,
      monthlyLimitAmount: body.policy?.monthlyLimitAmount ?? String(Number(body.amount) * 20),
      allowedChains: DEFAULT_POLICY_DEFAULTS.allowedChains,
      allowedInputTokens: [body.fromToken],
      allowedOutputTokens: [body.toToken],
      maxSlippageBps: body.policy?.maxSlippageBps ?? DEFAULT_POLICY_DEFAULTS.maxSlippageBps,
      allowedRouters: DEFAULT_POLICY_DEFAULTS.allowedRouters,
      requireFreshQuote: DEFAULT_POLICY_DEFAULTS.requireFreshQuote,
      quoteExpirySeconds: DEFAULT_POLICY_DEFAULTS.quoteExpirySeconds,
      requirePreflight: DEFAULT_POLICY_DEFAULTS.requirePreflight,
      requireApprovalHash: DEFAULT_POLICY_DEFAULTS.requireApprovalHash,
    });

    const finalAutomation = updateAutomation(automation.id, { policyId: policy.id, status: "approved" })!;

    recordAuditEvent({
      automationId: automation.id,
      type: "AUTOMATION_CREATED",
      message: `Automation "${automation.name}" created by ${caller}. Policy: max ${policy.maxExecutionAmount} ${body.fromToken}/execution, ${policy.dailyLimitAmount}/day.`,
    });

    return NextResponse.json({ ok: true, automation: finalAutomation, policy });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? `Failed to persist automation: ${err.message}` : "Failed to persist automation." },
      { status: 500 },
    );
  }
}
