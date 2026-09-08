"use client";

import Link from "next/link";
import { useMastraStore } from "@/lib/store";
import { useHydrated } from "@/lib/useHydrated";
import { shortHash } from "@/lib/mock";
import { ChainBadge } from "@/components/ChainBadge";
import { StatusPill } from "@/components/StatusPill";
import { PageShell, PageHeader, ConnectWalletPrompt } from "@/components/PageShell";
import type { ExecStepStatus } from "@/lib/types";

export default function ExecutionPage() {
  const hydrated = useHydrated();
  const connected = useMastraStore((s) => s.walletConnected);
  const proposal = useMastraStore((s) => s.proposal);
  const execution = useMastraStore((s) => s.execution);

  if (!hydrated) return null;

  if (!connected) {
    return (
      <PageShell>
        <PageHeader eyebrow="Execution" title="Live transaction progress" />
        <ConnectWalletPrompt message="Connect a wallet to watch KeeperHub execute an approved workflow in real time." />
      </PageShell>
    );
  }

  if (execution.status === "idle" || !proposal) {
    return (
      <PageShell>
        <PageHeader eyebrow="Execution" title="Nothing is executing right now" />
        <div className="card flex flex-col items-center gap-4 px-8 py-16 text-center">
          <p className="max-w-sm text-sm text-text-secondary">
            Approve a workflow from the Workflow Review screen to watch KeeperHub execute it here.
          </p>
          <Link href="/" className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#04262c]">
            Back to Dashboard
          </Link>
        </div>
      </PageShell>
    );
  }

  const confirmed = execution.status === "confirmed";

  return (
    <PageShell>
      <PageHeader
        eyebrow="Execution"
        title={proposal.intent}
        description={confirmed ? "KeeperHub executed the exact workflow you approved." : "KeeperHub is executing the exact workflow you approved — no substitutions, no surprises."}
        action={
          confirmed ? (
            <StatusPill tone="success" dot>Transaction Confirmed ✓</StatusPill>
          ) : (
            <StatusPill tone="accent" dot pulse>Executing…</StatusPill>
          )
        }
      />

      <div className="card px-6 py-6">
        <div className="flex flex-col">
          {execution.steps.map((step, i) => {
            const isLast = i === execution.steps.length - 1;
            return (
              <div key={step.actionId} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <StepDot status={step.status} />
                  {!isLast && (
                    <span
                      className="w-px flex-1 min-h-10"
                      style={{
                        background:
                          step.status === "confirmed" ? "var(--success)" : "var(--border-strong)",
                      }}
                    />
                  )}
                </div>
                <div className={`pb-8 ${isLast ? "pb-0" : ""}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">{step.label}</span>
                    <ChainBadge chain={step.chain} size="sm" />
                    <StepLabel status={step.status} />
                  </div>
                  {step.txHash && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="font-mono text-xs text-text-muted">{shortHash(step.txHash, 8, 6)}</span>
                      <span className="text-[11px] text-accent">view on explorer ↗</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {confirmed && (
        <div className="fade-up mt-6 card border-success/30 bg-success-dim/40 px-6 py-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-dim text-success">
            <svg width="22" height="22" viewBox="0 0 14 14" fill="none">
              <path d="M2 7.5L5.2 10.5L12 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="mt-3 text-base font-semibold text-text-primary">Transaction confirmed</div>
          <div className="mt-2 flex items-center justify-center gap-2">
            <span className="font-mono text-sm text-text-secondary">{shortHash(execution.finalTxHash ?? "", 10, 8)}</span>
          </div>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/audit"
              className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-[#04262c] transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              View Audit Record
            </Link>
            <Link
              href="/"
              className="rounded-lg border border-border-strong px-5 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      )}
    </PageShell>
  );
}

function StepDot({ status }: { status: ExecStepStatus }) {
  if (status === "confirmed") {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success-dim text-success">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 7.5L5.2 10.5L12 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  if (status === "active") {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-accent">
        <span className="h-2.5 w-2.5 rounded-full bg-accent pulse-dot" />
      </span>
    );
  }
  return <span className="h-7 w-7 shrink-0 rounded-full border-2 border-border-strong" />;
}

function StepLabel({ status }: { status: ExecStepStatus }) {
  if (status === "confirmed") return <StatusPill tone="success">Confirmed</StatusPill>;
  if (status === "active") return <StatusPill tone="accent" dot pulse>Submitting…</StatusPill>;
  return <StatusPill tone="neutral">Pending</StatusPill>;
}
