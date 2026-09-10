"use client";

import { useState } from "react";
import { useHydrated } from "@/lib/useHydrated";
import { PageShell, PageHeader } from "@/components/PageShell";
import { loadHistory } from "@/lib/swapHistory";
import { HistoryRow } from "@/app/swap/page";

/**
 * Real audit trail: every real swap attempt recorded in this browser,
 * success or failure, read straight from the same localStorage history
 * /swap writes to. Not shared across devices/viewers — see swapHistory.ts.
 */
export default function AuditPage() {
  const hydrated = useHydrated();
  const [history] = useState(() => (typeof window === "undefined" ? [] : loadHistory()));

  if (!hydrated) return null;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Real history — this browser"
        title="Audit Trail"
        description="Every real swap attempt made from this browser, success or failure, with its real transaction hash where one exists. Nothing here is simulated or backfilled."
      />

      {history.length === 0 ? (
        <div className="card flex flex-col items-center gap-4 px-8 py-16 text-center">
          <p className="max-w-sm text-sm text-text-secondary">No swaps recorded yet in this browser.</p>
          <a href="/swap" className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white">
            Go to Swap
          </a>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {history.map((entry, i) => (
            <HistoryRow key={`${entry.timestamp}-${i}`} entry={entry} last={i === history.length - 1} />
          ))}
        </div>
      )}
    </PageShell>
  );
}
