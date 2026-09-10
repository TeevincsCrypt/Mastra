"use client";

import { useEffect, useState } from "react";
import { useHydrated } from "@/lib/useHydrated";
import { PageShell, PageHeader } from "@/components/PageShell";
import { StatusPill } from "@/components/StatusPill";
import { shortHash } from "@/lib/format";
import type { Automation, Policy, PolicyDecision } from "@/lib/store/types";

interface AutomationWithPolicy {
  automation: Automation;
  policy: Policy;
}

export default function PoliciesPage() {
  const hydrated = useHydrated();
  const [items, setItems] = useState<AutomationWithPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AutomationWithPolicy | null>(null);

  const [testAmount, setTestAmount] = useState("1.0");
  const [testResult, setTestResult] = useState<PolicyDecision | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetch("/api/automations")
      .then((r) => r.json())
      .then(async (data) => {
        if (!data.ok) return;
        const withPolicies: AutomationWithPolicy[] = [];
        for (const automation of data.automations as Automation[]) {
          const detail = await fetch(`/api/automations/${automation.id}`).then((r) => r.json());
          if (detail.ok && detail.policy) withPolicies.push({ automation, policy: detail.policy });
        }
        setItems(withPolicies);
        if (withPolicies.length > 0) setSelected(withPolicies[0]);
      })
      .finally(() => setLoading(false));
  }, []);

  async function runTest() {
    if (!selected) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/policies/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          policyId: selected.policy.id,
          automationId: selected.automation.id,
          fromToken: selected.automation.fromToken,
          toToken: selected.automation.toToken,
          amount: testAmount,
        }),
      });
      const data = await res.json();
      if (data.ok) setTestResult(data.decision);
    } finally {
      setTesting(false);
    }
  }

  if (!hydrated) return null;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Spending boundaries"
        title="Policies"
        description="A deterministic decision engine — not an LLM's opinion. Every automation's real policy is evaluated here, with the exact check that failed, before KeeperHub is ever called."
      />

      {loading ? (
        <div className="card px-6 py-10 text-center text-sm text-text-muted">Loading…</div>
      ) : items.length === 0 ? (
        <div className="card px-8 py-16 text-center text-sm text-text-secondary">No policies yet — create an automation first.</div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.1fr]">
          <div className="card overflow-hidden">
            {items.map((item, i) => (
              <button
                key={item.policy.id}
                onClick={() => {
                  setSelected(item);
                  setTestResult(null);
                }}
                className={`block w-full px-5 py-4 text-left text-sm transition-colors hover:bg-surface-hover ${i === items.length - 1 ? "" : "border-b border-border"} ${selected?.policy.id === item.policy.id ? "bg-surface-hover" : ""}`}
              >
                <div className="font-semibold text-text-primary">{item.automation.name}</div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
                  <span>Max: {item.policy.maxExecutionAmount} {item.automation.fromToken}</span>
                  <span>Daily: {item.policy.dailyLimitAmount} {item.automation.fromToken}</span>
                  <span>Slippage: {item.policy.maxSlippageBps}bps</span>
                </div>
              </button>
            ))}
          </div>

          {selected && (
            <div className="flex flex-col gap-4">
              <div className="card p-6">
                <div className="mb-3 text-sm font-semibold text-text-primary">{selected.automation.name} — policy detail</div>
                <div className="flex flex-col gap-2 text-sm">
                  <Row label="Max / execution" value={`${selected.policy.maxExecutionAmount} ${selected.automation.fromToken}`} />
                  <Row label="Daily limit" value={`${selected.policy.dailyLimitAmount} ${selected.automation.fromToken}`} />
                  <Row label="Monthly limit" value={`${selected.policy.monthlyLimitAmount} ${selected.automation.fromToken}`} />
                  <Row label="Allowed chains" value={selected.policy.allowedChains.join(", ")} />
                  <Row label="Allowed input" value={selected.policy.allowedInputTokens.join(", ")} />
                  <Row label="Allowed output" value={selected.policy.allowedOutputTokens.join(", ")} />
                  <Row label="Max slippage" value={`${selected.policy.maxSlippageBps}bps`} />
                  <Row label="Allowed router" value={shortHash(selected.policy.allowedRouters[0] ?? "", 6, 4)} />
                  <Row label="Quote expiry" value={`${selected.policy.quoteExpirySeconds}s`} />
                </div>
              </div>

              <div className="card p-6">
                <div className="mb-3 text-sm font-semibold text-text-primary">Test this policy</div>
                <div className="flex items-end gap-3">
                  <label className="flex flex-1 flex-col gap-1.5 text-sm text-text-secondary">
                    Proposed amount ({selected.automation.fromToken})
                    <input value={testAmount} onChange={(e) => setTestAmount(e.target.value)} className="rounded-lg border border-border-strong bg-transparent px-3 py-2.5 text-sm text-text-primary" />
                  </label>
                  <button onClick={runTest} disabled={testing} className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                    {testing ? "Checking…" : "Evaluate"}
                  </button>
                </div>

                {testResult && (
                  <div className="mt-4 flex flex-col gap-3">
                    <StatusPill tone={testResult.approved ? "success" : "danger"} dot>
                      {testResult.approved ? "APPROVED FOR EXECUTION" : "BLOCKED"}
                    </StatusPill>
                    {!testResult.approved && testResult.reason && <p className="text-sm text-danger">{testResult.reason}</p>}
                    <div className="flex flex-col gap-1.5">
                      {testResult.checks.map((c) => (
                        <div key={c.key} className="flex items-center gap-2 text-xs">
                          <span className={c.passed ? "text-success" : "text-danger"}>{c.passed ? "✓" : "✗"}</span>
                          <span className={c.passed ? "text-text-secondary" : "text-danger"}>{c.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-1.5 last:border-b-0">
      <span className="shrink-0 text-text-muted">{label}</span>
      <span className="text-right font-mono text-xs text-text-primary">{value}</span>
    </div>
  );
}
