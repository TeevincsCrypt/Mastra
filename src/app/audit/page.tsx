"use client";

import { useState } from "react";
import { useMastraStore } from "@/lib/store";
import { useHydrated } from "@/lib/useHydrated";
import { shortHash } from "@/lib/mock";
import { ChainRoute } from "@/components/ChainBadge";
import { StatusPill } from "@/components/StatusPill";
import { PageShell, PageHeader, ConnectWalletPrompt } from "@/components/PageShell";
import type { ExecutionRecord } from "@/lib/types";

export default function AuditTrailPage() {
  const hydrated = useHydrated();
  const connected = useMastraStore((s) => s.walletConnected);
  const auditTrail = useMastraStore((s) => s.auditTrail);

  if (!hydrated) return null;

  if (!connected) {
    return (
      <PageShell>
        <PageHeader eyebrow="Audit Trail" title="Complete execution history" />
        <ConnectWalletPrompt message="Connect a wallet to view the auditable history of approved and executed workflows." />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Audit Trail"
        title="Complete execution history"
        description="Every approved workflow, exactly as it was simulated, approved and executed on-chain."
        action={<StatusPill tone="neutral">{auditTrail.length} record{auditTrail.length === 1 ? "" : "s"}</StatusPill>}
      />

      {auditTrail.length === 0 ? (
        <div className="card px-8 py-16 text-center text-sm text-text-muted">
          No executions recorded yet. Approve a workflow to create your first audit record.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {auditTrail.map((record) => (
            <AuditRow key={record.id} record={record} />
          ))}
        </div>
      )}
    </PageShell>
  );
}

function AuditRow({ record }: { record: ExecutionRecord }) {
  const [open, setOpen] = useState(false);
  const duration = record.finishedAt ? ((record.finishedAt - record.startedAt) / 1000).toFixed(1) : "—";

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <StatusPill tone={record.status === "confirmed" ? "success" : "danger"} dot>
            {record.status === "confirmed" ? "Confirmed" : "Failed"}
          </StatusPill>
          <div>
            <div className="text-sm font-medium text-text-primary">{record.intent}</div>
            <div className="mt-0.5 text-xs text-text-muted">
              {new Date(record.startedAt).toLocaleString()}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <ChainRoute from={record.fromChain} to={record.toChain} />
          <span className="hidden font-mono text-xs text-text-muted sm:inline">
            {shortHash(record.finalTxHash ?? "")}
          </span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            className={`shrink-0 text-text-muted transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path d="M3 5.5L7 9.5L11 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="border-t border-border px-5 py-4">
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Detail label="Amount" value={`${record.amount} ${record.token}`} />
            <Detail label="USD value" value={`$${record.usdValue}`} />
            <Detail label="Duration" value={`${duration}s`} />
            <Detail label="Simulation" value={record.simulationPassed ? "Passed ✓" : "—"} />
          </div>

          <div className="mb-4">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Approved by</div>
            <div className="font-mono text-xs text-text-secondary">{record.approvedBy}</div>
          </div>

          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Execution steps</div>
          <div className="flex flex-col gap-2">
            {record.steps.map((step) => (
              <div
                key={step.actionId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-bg-elevated px-3 py-2"
              >
                <span className="text-xs font-medium text-text-primary">{step.label}</span>
                <span className="font-mono text-xs text-text-muted">{shortHash(step.txHash ?? "", 8, 6)}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between rounded-lg border border-success/30 bg-success-dim px-4 py-3">
            <span className="text-xs font-medium text-success">Final transaction</span>
            <span className="font-mono text-xs text-success">{record.finalTxHash}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-text-primary">{value}</div>
    </div>
  );
}
