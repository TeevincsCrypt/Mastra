import type { Policy, PolicyCheckItem, PolicyDecision } from "@/lib/store/types";

/**
 * Deterministic policy decision engine. Pure function, no I/O, no LLM —
 * given a proposed operation and a policy, it returns APPROVED or BLOCKED
 * with an explicit, itemized reason. This is the actual gate between "an
 * agent proposed something" and "KeeperHub executes it" — see
 * /api/automations/[id]/execute, the only caller that's allowed to invoke
 * KeeperHub's real execute() endpoint, and only after this returns
 * approved: true.
 */

export interface PolicyEvaluationInput {
  policy: Policy;
  chainId: string;
  fromToken: string;
  toToken: string;
  /** Requested amount in fromToken's own units (human-readable decimal string, e.g. "1.2"). */
  amount: string;
  routerAddress: string;
  slippageBps: number;
  /** Milliseconds since epoch when the Wayfinder quote backing this proposal was fetched. */
  quoteFetchedAt: number;
  /** Real spend, in fromToken units, already executed today for this automation (sum of successful, KeeperHub-executed transactions only — see store/executions.ts sumSpentSince). */
  spentTodayAmount: number;
  /** Same, for the current calendar month. */
  spentThisMonthAmount: number;
  now?: number;
}

export function evaluatePolicy(input: PolicyEvaluationInput): PolicyDecision {
  const now = input.now ?? Date.now();
  const requestedAmount = Number(input.amount);
  const checks: PolicyCheckItem[] = [];

  const chainAllowed = input.policy.allowedChains.includes(input.chainId);
  checks.push({
    key: "chain",
    label: "Chain allowed",
    passed: chainAllowed,
    detail: chainAllowed ? undefined : `Chain ${input.chainId} is not in the allowed list: ${input.policy.allowedChains.join(", ")}`,
  });

  const inputAllowed = input.policy.allowedInputTokens.includes(input.fromToken);
  checks.push({
    key: "input_token",
    label: "Input token allowed",
    passed: inputAllowed,
    detail: inputAllowed ? undefined : `${input.fromToken} is not in the allowed input tokens: ${input.policy.allowedInputTokens.join(", ")}`,
  });

  const outputAllowed = input.policy.allowedOutputTokens.includes(input.toToken);
  checks.push({
    key: "output_token",
    label: "Output token allowed",
    passed: outputAllowed,
    detail: outputAllowed ? undefined : `${input.toToken} is not in the allowed output tokens: ${input.policy.allowedOutputTokens.join(", ")}`,
  });

  const maxExecution = Number(input.policy.maxExecutionAmount);
  const withinExecutionLimit = requestedAmount <= maxExecution;
  checks.push({
    key: "execution_limit",
    label: "Amount within execution limit",
    passed: withinExecutionLimit,
    detail: withinExecutionLimit
      ? undefined
      : `Requested ${requestedAmount} ${input.fromToken} exceeds maximum execution size of ${maxExecution} ${input.fromToken}.`,
  });

  const dailyLimit = Number(input.policy.dailyLimitAmount);
  const dailyRemaining = dailyLimit - input.spentTodayAmount;
  const withinDaily = requestedAmount <= dailyRemaining;
  checks.push({
    key: "daily_budget",
    label: "Daily budget available",
    passed: withinDaily,
    detail: withinDaily
      ? undefined
      : `Requested ${requestedAmount} ${input.fromToken} exceeds remaining daily budget of ${Math.max(dailyRemaining, 0)} ${input.fromToken} (limit ${dailyLimit}, already spent ${input.spentTodayAmount} today).`,
  });

  const monthlyLimit = Number(input.policy.monthlyLimitAmount);
  const monthlyRemaining = monthlyLimit - input.spentThisMonthAmount;
  const withinMonthly = requestedAmount <= monthlyRemaining;
  checks.push({
    key: "monthly_budget",
    label: "Monthly budget available",
    passed: withinMonthly,
    detail: withinMonthly
      ? undefined
      : `Requested ${requestedAmount} ${input.fromToken} exceeds remaining monthly budget of ${Math.max(monthlyRemaining, 0)} ${input.fromToken}.`,
  });

  const slippageOk = input.slippageBps <= input.policy.maxSlippageBps;
  checks.push({
    key: "slippage",
    label: "Slippage within limit",
    passed: slippageOk,
    detail: slippageOk ? undefined : `Slippage ${input.slippageBps}bps exceeds policy maximum of ${input.policy.maxSlippageBps}bps.`,
  });

  const routerAllowed = input.policy.allowedRouters.some((r) => r.toLowerCase() === input.routerAddress.toLowerCase());
  checks.push({
    key: "destination",
    label: "Destination allowed",
    passed: routerAllowed,
    detail: routerAllowed ? undefined : `Router ${input.routerAddress} is not on this policy's allowed-router list.`,
  });

  const quoteAgeSeconds = Math.floor((now - input.quoteFetchedAt) / 1000);
  const quoteFresh = !input.policy.requireFreshQuote || quoteAgeSeconds <= input.policy.quoteExpirySeconds;
  checks.push({
    key: "quote_freshness",
    label: "Fresh quote",
    passed: quoteFresh,
    detail: quoteFresh ? undefined : `Quote is ${quoteAgeSeconds}s old, exceeding this policy's ${input.policy.quoteExpirySeconds}s expiry.`,
  });

  const approved = checks.every((c) => c.passed);
  const firstFailure = checks.find((c) => !c.passed);

  return {
    approved,
    checks,
    reason: firstFailure?.detail,
    evaluatedAt: now,
  };
}
