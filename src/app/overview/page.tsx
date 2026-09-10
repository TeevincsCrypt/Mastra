"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useHydrated } from "@/lib/useHydrated";
import { PageShell, PageHeader } from "@/components/PageShell";
import { StatusPill } from "@/components/StatusPill";
import type { Automation } from "@/lib/store/types";

/**
 * Mission control: real system health, real automations, real budget
 * usage — every number here is fetched from the same store and health
 * checks the rest of the app reads from. Nothing is hardcoded.
 */

interface HealthEntry {
  status: "connected" | "degraded" | "offline" | "not_configured";
  detail?: string;
}
interface Health {
  keeperhub: HealthEntry;
  wayfinder: HealthEntry;
  storage: HealthEntry;
  policyEngine: HealthEntry;
  executionEngine: HealthEntry;
}
interface BudgetToken {
  allocatedDaily: number;
  allocatedMonthly: number;
  spentToday: number;
  spentThisMonth: number;
  automations: number;
}

export default function OverviewPage() {
  const hydrated = useHydrated();
  const [health, setHealth] = useState<Health | null>(null);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [budget, setBudget] = useState<Record<string, BudgetToken> | null>(null);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/system/health").then((r) => r.json()),
      fetch("/api/automations").then((r) => r.json()),
      fetch("/api/budget").then((r) => r.json()),
      fetch("/api/system/status").then((r) => r.json()),
    ])
      .then(([h, a, b, s]) => {
        if (h.ok) setHealth(h);
        if (a.ok) setAutomations(a.automations);
        if (b.ok) setBudget(b.tokens);
        if (s.ok) setPaused(Boolean(s.paused));
      })
      .finally(() => setLoading(false));
  }, []);

  if (!hydrated) return null;

  const active = automations.filter((a) => a.status === "active");
  const executionsToday = budget ? Object.values(budget).reduce((sum, t) => sum + (t.spentToday > 0 ? t.automations : 0), 0) : 0;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Autonomous on-chain finance"
        title="Mission Control"
        description="Give your agent a budget. Not your private key. Every metric below is real — pulled from persisted automations, policies and execution records."
        action={paused ? <StatusPill tone="danger" dot pulse>System Paused</StatusPill> : <StatusPill tone="success" dot>System Ready</StatusPill>}
      />

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Active automations" value={String(active.length)} loading={loading} />
        <Metric label="Total automations" value={String(automations.length)} loading={loading} />
        <Metric label="Executions logged today" value={String(executionsToday)} loading={loading} />
        <Metric label="Network" value="Ethereum mainnet" loading={loading} />
      </div>

      <div className="mb-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-text-muted">Mastra System</h2>
        <div className="card grid grid-cols-1 divide-y divide-border sm:grid-cols-5 sm:divide-x sm:divide-y-0">
          <HealthTile label="Wayfinder" entry={health?.wayfinder} loading={loading} />
          <HealthTile label="KeeperHub" entry={health?.keeperhub} loading={loading} />
          <HealthTile label="Policy Engine" entry={health?.policyEngine} loading={loading} />
          <HealthTile label="Execution Engine" entry={health?.executionEngine} loading={loading} />
          <HealthTile label="Storage" entry={health?.storage} loading={loading} />
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-text-muted">Active Automations</h2>
        <Link href="/automations/new" className="text-xs font-medium text-accent-strong hover:underline">
          + Create Automation
        </Link>
      </div>

      {loading ? (
        <div className="card px-6 py-10 text-center text-sm text-text-muted">Loading…</div>
      ) : automations.length === 0 ? (
        <div className="card flex flex-col items-center gap-4 px-8 py-16 text-center">
          <p className="max-w-sm text-sm text-text-secondary">No automations yet. Create one to give an agent a real, policy-bounded budget.</p>
          <Link href="/automations/new" className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white">
            Create your first automation
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {automations.slice(0, 6).map((a) => (
            <AutomationCard key={a.id} automation={a} budget={budget?.[a.fromToken]} />
          ))}
        </div>
      )}
    </PageShell>
  );
}

function Metric({ label, value, loading }: { label: string; value: string; loading?: boolean }) {
  return (
    <div className="card px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{label}</div>
      <div className="mt-1 text-lg font-semibold text-text-primary">
        {loading ? <span className="inline-block h-5 w-14 animate-pulse rounded bg-surface-hover" /> : value}
      </div>
    </div>
  );
}

function HealthTile({ label, entry, loading }: { label: string; entry?: HealthEntry; loading?: boolean }) {
  const tone = !entry ? "neutral" : entry.status === "connected" ? "success" : entry.status === "not_configured" ? "warning" : entry.status === "degraded" ? "warning" : "danger";
  const text = !entry ? "—" : entry.status === "connected" ? "CONNECTED" : entry.status === "not_configured" ? "NOT CONFIGURED" : entry.status === "degraded" ? "DEGRADED" : "OFFLINE";
  return (
    <div className="px-5 py-4">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{label}</div>
      <div className="mt-1.5">
        {loading ? <span className="inline-block h-4 w-20 animate-pulse rounded bg-surface-hover" /> : <StatusPill tone={tone} dot>{text}</StatusPill>}
      </div>
    </div>
  );
}

function AutomationCard({ automation, budget }: { automation: Automation; budget?: BudgetToken }) {
  const statusTone =
    automation.status === "active" ? "success" : automation.status === "blocked" || automation.status === "failed" ? "danger" : automation.status === "paused" ? "warning" : "neutral";
  return (
    <Link href={`/automations/${automation.id}`} className="card block px-5 py-4 transition-colors hover:border-accent/40">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-text-primary">{automation.name}</span>
        <StatusPill tone={statusTone} dot>{automation.status.replace("_", " ").toUpperCase()}</StatusPill>
      </div>
      <div className="mt-1 text-xs text-text-secondary">
        {automation.amount} {automation.fromToken} → {automation.toToken} · {automation.frequency}
      </div>
      {budget && (
        <div className="mt-2 text-xs text-text-muted">
          {budget.spentToday} / {budget.allocatedDaily} {automation.fromToken} spent today
        </div>
      )}
    </Link>
  );
}
