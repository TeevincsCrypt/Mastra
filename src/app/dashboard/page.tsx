"use client";

import Link from "next/link";
import { useMastraStore } from "@/lib/store";
import { useWallet } from "@/lib/useWallet";
import { useHydrated } from "@/lib/useHydrated";
import { shortHash } from "@/lib/mock";
import { ChainRoute } from "@/components/ChainBadge";
import { StatusPill } from "@/components/StatusPill";
import { PageShell, PageHeader, ConnectWalletPrompt } from "@/components/PageShell";

export default function DashboardPage() {
  const hydrated = useHydrated();
  const { isConnected, isWrongNetwork } = useWallet();

  if (!hydrated) return null;

  if (!isConnected || isWrongNetwork) {
    return (
      <PageShell>
        <PageHeader eyebrow="Dashboard" title="Agent status, pending actions, recent executions" />
        <ConnectWalletPrompt message="Connect a wallet to see Wayfinder's agent status and any pending proposals waiting on your review." />
      </PageShell>
    );
  }

  return <ConnectedDashboard />;
}

function ConnectedDashboard() {
  const { address } = useWallet();
  const proposal = useMastraStore((s) => s.proposal);
  const proposalStatus = useMastraStore((s) => s.proposalStatus);
  const execution = useMastraStore((s) => s.execution);
  const auditTrail = useMastraStore((s) => s.auditTrail);
  const requestProposal = useMastraStore((s) => s.requestProposal);

  const pendingVisible = proposalStatus === "ready" && execution.status === "idle";
  const executingVisible = execution.status === "running";
  const idleNoProposal = proposalStatus === "none";

  return (
    <PageShell>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-text-muted">Dashboard</div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">
            Welcome back
          </h1>
          <p className="mt-1 font-mono text-xs text-text-muted">{shortHash(address ?? "", 8, 6)}</p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <AgentStatusCard
          name="Wayfinder"
          role="Proposes workflows"
          tone="wayfinder"
          detail={proposalStatus === "incoming" ? "Drafting proposal…" : "Online · watching wallet intents"}
          active={proposalStatus === "incoming"}
        />
        <AgentStatusCard
          name="KeeperHub"
          role="Simulates & executes"
          tone="accent"
          detail="Online · ready to validate"
          active={executingVisible}
        />
      </div>

      <div className="mb-8">
        <div className="mb-3 text-sm font-medium text-text-secondary">Pending Actions</div>

        {proposalStatus === "incoming" && (
          <div className="card scan-line relative overflow-hidden px-6 py-8">
            <div className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full bg-wayfinder pulse-dot" />
              <span className="text-sm font-medium text-text-primary">
                Wayfinder is drafting a workflow proposal…
              </span>
            </div>
          </div>
        )}

        {pendingVisible && proposal && (
          <div className="card fade-up card-hover flex flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <StatusPill tone="wayfinder" dot>Wayfinder proposal</StatusPill>
                <StatusPill tone="warning">Awaiting review</StatusPill>
              </div>
              <div className="text-base font-medium text-text-primary">{proposal.intent}</div>
              <div className="mt-2">
                <ChainRoute from={proposal.fromChain} to={proposal.toChain} />
              </div>
            </div>
            <Link
              href="/workflow"
              className="whitespace-nowrap rounded-lg bg-accent px-4 py-2.5 text-center text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Review Workflow
            </Link>
          </div>
        )}

        {executingVisible && (
          <Link href="/execution" className="card card-hover flex items-center justify-between px-6 py-6">
            <div className="flex items-center gap-3">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              <span className="text-sm font-medium text-text-primary">Execution in progress — view live status</span>
            </div>
            <span className="text-accent">&rarr;</span>
          </Link>
        )}

        {idleNoProposal && (
          <div className="card flex flex-col items-center gap-3 px-6 py-10 text-center">
            <p className="text-sm text-text-secondary">No pending actions. Wayfinder isn&apos;t proposing anything right now.</p>
            <button
              onClick={requestProposal}
              className="rounded-lg border border-border-strong bg-surface-hover px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:border-accent/50"
            >
              Simulate incoming Wayfinder request
            </button>
          </div>
        )}

        {execution.status === "confirmed" && (
          <div className="card flex items-center justify-between px-6 py-5">
            <span className="text-sm text-text-secondary">Last workflow executed successfully.</span>
            <button
              onClick={requestProposal}
              className="rounded-lg border border-border-strong bg-surface-hover px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:border-accent/50"
            >
              Request another workflow
            </button>
          </div>
        )}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-medium text-text-secondary">Recent Executions</div>
          {auditTrail.length > 0 && (
            <Link href="/audit" className="text-xs font-medium text-accent hover:text-accent-strong">
              View audit trail &rarr;
            </Link>
          )}
        </div>

        {auditTrail.length === 0 ? (
          <div className="card px-6 py-10 text-center text-sm text-text-muted">
            Executions you approve will appear here with their transaction hash and audit record.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {auditTrail.slice(0, 3).map((record) => (
              <Link
                key={record.id}
                href="/audit"
                className="card card-hover flex flex-wrap items-center justify-between gap-3 px-5 py-4"
              >
                <div className="flex items-center gap-3">
                  <StatusPill tone="success" dot>Confirmed</StatusPill>
                  <span className="text-sm text-text-primary">{record.intent}</span>
                </div>
                <span className="font-mono text-xs text-text-muted">{shortHash(record.finalTxHash ?? "")}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}

function AgentStatusCard({
  name,
  role,
  tone,
  detail,
  active,
}: {
  name: string;
  role: string;
  tone: "wayfinder" | "accent";
  detail: string;
  active?: boolean;
}) {
  const color = tone === "wayfinder" ? "var(--wayfinder)" : "var(--accent)";
  return (
    <div className="card flex items-center justify-between px-5 py-4">
      <div className="flex items-center gap-3">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-lg border"
          style={{ borderColor: `${color}40`, background: `${color}14` }}
        >
          <span className={`h-2 w-2 rounded-full ${active ? "pulse-dot" : ""}`} style={{ background: color }} />
        </span>
        <div>
          <div className="text-sm font-medium text-text-primary">{name}</div>
          <div className="text-xs text-text-muted">{role}</div>
        </div>
      </div>
      <div className="text-xs text-text-secondary">{detail}</div>
    </div>
  );
}
