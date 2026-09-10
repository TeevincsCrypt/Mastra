"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useHydrated } from "@/lib/useHydrated";
import { PageShell, PageHeader } from "@/components/PageShell";
import { StatusPill } from "@/components/StatusPill";
import type { Automation } from "@/lib/store/types";

export default function AutomationsPage() {
  const hydrated = useHydrated();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/automations")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setAutomations(data.automations);
      })
      .finally(() => setLoading(false));
  }, []);

  if (!hydrated) return null;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Autonomous strategies"
        title="Automations"
        description="Each automation runs under its own policy — a spending boundary the agent cannot exceed, enforced server-side before KeeperHub is ever called."
        action={
          <Link href="/automations/new" className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]">
            + Create Automation
          </Link>
        }
      />

      {loading ? (
        <div className="card px-6 py-10 text-center text-sm text-text-muted">Loading…</div>
      ) : automations.length === 0 ? (
        <div className="card flex flex-col items-center gap-4 px-8 py-16 text-center">
          <p className="max-w-sm text-sm text-text-secondary">No automations yet.</p>
          <Link href="/automations/new" className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white">
            Create your first automation
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {automations.map((a, i) => (
            <AutomationRow key={a.id} automation={a} last={i === automations.length - 1} />
          ))}
        </div>
      )}
    </PageShell>
  );
}

function AutomationRow({ automation, last }: { automation: Automation; last?: boolean }) {
  const statusTone =
    automation.status === "active" ? "success" : automation.status === "blocked" || automation.status === "failed" ? "danger" : automation.status === "paused" ? "warning" : "neutral";
  return (
    <Link
      href={`/automations/${automation.id}`}
      className={`flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm transition-colors hover:bg-surface-hover ${last ? "" : "border-b border-border"}`}
    >
      <div>
        <div className="font-semibold text-text-primary">{automation.name}</div>
        <div className="mt-0.5 text-xs text-text-secondary">
          {automation.amount} {automation.fromToken} → {automation.toToken} · {automation.frequency} · {automation.triggerDescription}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {automation.lastExecutionStatus && (
          <span className="text-xs text-text-muted">last: {automation.lastExecutionStatus}</span>
        )}
        <StatusPill tone={statusTone} dot>{automation.status.replace("_", " ").toUpperCase()}</StatusPill>
      </div>
    </Link>
  );
}
