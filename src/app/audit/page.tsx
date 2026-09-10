"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useHydrated } from "@/lib/useHydrated";
import { PageShell, PageHeader } from "@/components/PageShell";
import { loadHistory } from "@/lib/swapHistory";
import { HistoryRow } from "@/app/swap/page";
import { shortHash } from "@/lib/format";
import type { Automation, AuditEvent } from "@/lib/store/types";

/**
 * Two real, independent audit trails, not one blended feed:
 * 1. Server-side AuditEvent stream for every automation — persisted in
 *    the file store, visible to any viewer, the record of record for the
 *    policy/execution pipeline.
 * 2. This browser's own direct-/swap history — real, but localStorage-only
 *    and never shared across devices/viewers (see swapHistory.ts). Kept
 *    separate rather than merged so neither trail misrepresents its scope.
 */
export default function AuditPage() {
  const hydrated = useHydrated();
  const [history] = useState(() => (typeof window === "undefined" ? [] : loadHistory()));

  const [automations, setAutomations] = useState<Automation[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [filterId, setFilterId] = useState<string>("all");

  useEffect(() => {
    Promise.all([fetch("/api/automations").then((r) => r.json()), fetch("/api/audit").then((r) => r.json())])
      .then(([a, e]) => {
        if (a.ok) setAutomations(a.automations);
        if (e.ok) setEvents(e.events);
      })
      .finally(() => setLoadingEvents(false));
  }, []);

  if (!hydrated) return null;

  const nameFor = (id?: string) => (id ? automations.find((a) => a.id === id)?.name ?? id : "System-wide");
  const visibleEvents = filterId === "all" ? events : events.filter((e) => e.automationId === filterId);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Real, server-side record"
        title="Audit Trail"
        description="Every real stage an automation's execution passed through — trigger, quote, policy decision, KeeperHub call, transaction result — persisted server-side as it happens. Nothing here is simulated or backfilled."
        action={
          automations.length > 0 && (
            <select
              value={filterId}
              onChange={(e) => setFilterId(e.target.value)}
              className="rounded-lg border border-border-strong bg-transparent px-3 py-2 text-xs text-text-primary"
            >
              <option value="all">All automations</option>
              {automations.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )
        }
      />

      {loadingEvents ? (
        <div className="card px-6 py-10 text-center text-sm text-text-muted">Loading…</div>
      ) : visibleEvents.length === 0 ? (
        <div className="card flex flex-col items-center gap-4 px-8 py-16 text-center">
          <p className="max-w-sm text-sm text-text-secondary">No automation audit events yet. Create and run an automation to populate this trail.</p>
          <Link href="/automations/new" className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white">
            Create an automation
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {visibleEvents.map((e, i) => (
            <EventRow key={e.id} event={e} automationName={nameFor(e.automationId)} last={i === visibleEvents.length - 1} />
          ))}
        </div>
      )}

      <div className="mt-10">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-text-muted">
          Direct Swap History — this browser only
        </h2>
        {history.length === 0 ? (
          <div className="card flex flex-col items-center gap-4 px-8 py-16 text-center">
            <p className="max-w-sm text-sm text-text-secondary">No swaps recorded yet in this browser.</p>
            <Link href="/swap" className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white">
              Go to Swap
            </Link>
          </div>
        ) : (
          <div className="card overflow-hidden">
            {history.map((entry, i) => (
              <HistoryRow key={`${entry.timestamp}-${i}`} entry={entry} last={i === history.length - 1} />
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}

function EventRow({ event, automationName, last }: { event: AuditEvent; automationName?: string; last?: boolean }) {
  const attemptsLog = Array.isArray(event.metadata?.attemptsLog) ? (event.metadata!.attemptsLog as Array<Record<string, unknown>>) : null;
  return (
    <div className={`px-5 py-3 text-sm ${last ? "" : "border-b border-border"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-xs font-semibold text-text-primary">{event.type}</span>
        <span className="text-xs text-text-muted">{new Date(event.timestamp).toLocaleString()}</span>
      </div>
      <div className="mt-1 text-xs text-text-secondary">{event.message}</div>
      {attemptsLog && (
        <div className="mt-1.5 flex flex-col gap-0.5 border-l-2 border-border pl-2">
          {attemptsLog.map((a, i) => (
            <div key={i} className="text-[10px] text-text-muted">
              attempt {String(a.attempt)}
              {a.routerAddress ? ` — router ${shortHash(a.routerAddress, 6, 4)}` : ""}: {String(a.outcome)}
            </div>
          ))}
        </div>
      )}
      <div className="mt-1 text-[10px] uppercase tracking-wide text-text-muted">{automationName}</div>
    </div>
  );
}
