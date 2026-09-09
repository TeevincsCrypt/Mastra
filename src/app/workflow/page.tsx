"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMastraStore } from "@/lib/store";
import { useWallet } from "@/lib/useWallet";
import { useHydrated } from "@/lib/useHydrated";
import { shortHash } from "@/lib/mock";
import { ChainBadge, ChainRoute } from "@/components/ChainBadge";
import { StatusPill } from "@/components/StatusPill";
import { PageShell, PageHeader, ConnectWalletPrompt } from "@/components/PageShell";
import type { SimStepStatus, WorkflowAction } from "@/lib/types";

export default function WorkflowReviewPage() {
  const hydrated = useHydrated();
  const { isConnected, isWrongNetwork } = useWallet();
  const proposal = useMastraStore((s) => s.proposal);
  const proposalStatus = useMastraStore((s) => s.proposalStatus);
  const execution = useMastraStore((s) => s.execution);

  if (!hydrated) return null;

  if (!isConnected || isWrongNetwork) {
    return (
      <PageShell>
        <PageHeader eyebrow="Workflow Review" title="Every action, before it happens" />
        <ConnectWalletPrompt message="Connect a wallet to receive Wayfinder proposals and review the exact workflow before execution." />
      </PageShell>
    );
  }

  if (execution.status === "running" || execution.status === "confirmed") {
    return (
      <PageShell>
        <PageHeader eyebrow="Workflow Review" title="This workflow is already underway" />
        <div className="card flex flex-col items-center gap-4 px-8 py-16 text-center">
          <p className="max-w-sm text-sm text-text-secondary">
            {execution.status === "running"
              ? "Execution is currently in progress."
              : "This workflow has already been executed and recorded."}
          </p>
          <Link
            href={execution.status === "running" ? "/execution" : "/audit"}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
          >
            {execution.status === "running" ? "View live execution" : "View audit record"}
          </Link>
        </div>
      </PageShell>
    );
  }

  if (proposalStatus !== "ready" || !proposal) {
    return (
      <PageShell>
        <PageHeader eyebrow="Workflow Review" title="No workflow to review" />
        <div className="card flex flex-col items-center gap-4 px-8 py-16 text-center">
          <p className="max-w-sm text-sm text-text-secondary">
            There&apos;s no pending Wayfinder proposal right now. Head back to the dashboard to request one.
          </p>
          <Link href="/dashboard" className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white">
            Back to Dashboard
          </Link>
        </div>
      </PageShell>
    );
  }

  return <ReviewContent />;
}

function ReviewContent() {
  const router = useRouter();
  const { address } = useWallet();
  const proposal = useMastraStore((s) => s.proposal)!;
  const simulation = useMastraStore((s) => s.simulation);
  const runKeeperSimulation = useMastraStore((s) => s.runKeeperSimulation);
  const approveAndExecute = useMastraStore((s) => s.approveAndExecute);
  const rejectProposal = useMastraStore((s) => s.rejectProposal);

  const simIdle = simulation.status === "idle";
  const simRunning = simulation.status === "running";
  const simPassed = simulation.status === "passed";
  const simFailed = simulation.status === "failed";

  function handleApprove() {
    if (!address) return;
    approveAndExecute(address);
    router.push("/execution");
  }

  function handleReject() {
    rejectProposal();
    router.push("/");
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Workflow Review"
        title={proposal.intent}
        description="Wayfinder proposed this workflow. Review every action, contract, amount and chain before KeeperHub validates and executes it."
        action={
          <div className="flex items-center gap-2">
            <StatusPill tone="wayfinder" dot>Proposed by Wayfinder</StatusPill>
            <ChainRoute from={proposal.fromChain} to={proposal.toChain} />
          </div>
        }
      />

      <div className="mb-4 rounded-lg border border-wayfinder/30 bg-wayfinder-dim px-4 py-2.5 text-xs text-text-secondary">
        <span className="font-medium text-wayfinder">Representative proposal, not a live Wayfinder response.</span> Wayfinder&apos;s
        real capability for this is a local Python SDK/MCP tool, not a hosted API — there&apos;s no public endpoint
        Mastra&apos;s server can call the way it calls KeeperHub&apos;s. The KeeperHub preflight and execution below are real.
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryStat label="Amount" value={`${proposal.amount} ${proposal.token}`} />
        <SummaryStat label="Est. USD value" value={`$${proposal.usdValue}`} />
        <SummaryStat label="Actions" value={String(proposal.actions.length)} />
        <SummaryStat label="Proposal ID" value={proposal.id.replace("prop-", "#")} mono />
      </div>

      <div className="mb-8 flex flex-col gap-3">
        {proposal.actions.map((action) => (
          <ActionCard key={action.id} action={action} reviewed={simPassed} />
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md border border-accent/40 bg-accent-dim">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 7.5L5.2 10.5L12 3" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="text-sm font-semibold text-text-primary">KeeperHub Preflight</span>
          </div>
          {simRunning && <StatusPill tone="accent" dot pulse>Checking with KeeperHub…</StatusPill>}
          {simPassed && <StatusPill tone="success" dot>READY ✓</StatusPill>}
          {simFailed && <StatusPill tone="danger" dot>FAILED</StatusPill>}
        </div>

        <div className="px-6 py-5">
          {simIdle && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="max-w-sm text-sm text-text-secondary">
                KeeperHub will confirm the configured workflow is real, reachable, and targets the expected chain
                before you can approve anything. This is a genuine API call, not a transaction dry-run — KeeperHub
                doesn&apos;t expose one.
              </p>
              <button
                onClick={runKeeperSimulation}
                className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Run KeeperHub Preflight
              </button>
            </div>
          )}

          {simRunning && (
            <div className="flex items-center justify-center gap-3 py-6 text-center text-sm text-text-secondary">
              <span className="h-4 w-4 shrink-0 rounded-full border-2 border-accent border-t-transparent spin-slow" />
              Calling KeeperHub…
            </div>
          )}

          {simPassed && (
            <div className="flex flex-col gap-2">
              <PreflightRow label="Workflow ID" value={simulation.workflow?.id ?? "—"} mono />
              <PreflightRow label="Name" value={simulation.workflow?.name ?? "—"} />
              <PreflightRow label="Chain" value={simulation.workflow?.chain ?? "—"} />
              <div className="mt-2 flex items-center justify-between rounded-lg border border-success/30 bg-success-dim px-4 py-3">
                <span className="text-sm font-medium text-success">KeeperHub confirmed this workflow is ready to execute.</span>
              </div>
            </div>
          )}

          {simFailed && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <p className="max-w-sm text-sm text-danger">{simulation.error ?? "KeeperHub preflight failed."}</p>
              <button
                onClick={runKeeperSimulation}
                className="rounded-lg border border-border-strong px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:border-accent/50"
              >
                Retry Preflight
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-xs text-text-muted">
          Approving as <span className="font-mono text-text-secondary">{shortHash(address ?? "", 6, 4)}</span> — this
          is your identity/authorization only. Execution itself runs through KeeperHub&apos;s own non-custodial
          wallet, not yours; your wallet never signs the on-chain transaction.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleReject}
            className="rounded-lg border border-border-strong px-5 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:border-danger/50 hover:text-danger"
          >
            Reject
          </button>
          <button
            onClick={handleApprove}
            disabled={!simPassed}
            className="rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white transition-transform enabled:hover:scale-[1.02] enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Approve &amp; Execute
          </button>
        </div>
      </div>
    </PageShell>
  );
}

function SummaryStat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="card px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{label}</div>
      <div className={`mt-1 text-sm font-medium text-text-primary ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}

function ActionCard({ action, reviewed }: { action: WorkflowAction; reviewed?: boolean }) {
  return (
    <div className="card px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-3">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border-strong text-[11px] font-mono text-text-secondary">
            {action.order}
          </span>
          <div>
            <div className="text-sm font-semibold text-text-primary">{action.title}</div>
            <p className="mt-1 max-w-xl text-xs text-text-secondary">{action.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ChainBadge chain={action.chain} size="sm" />
          {reviewed && <StepStatusIcon status="passed" />}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border pt-3 text-xs">
        <Field label="Contract">
          <span className="inline-flex items-center gap-1.5">
            <span className="font-mono text-text-secondary">{action.contract.name}</span>
            <span className="font-mono text-text-muted">({shortHash(action.contract.address)})</span>
            {action.contract.verified && (
              <span className="text-success" title="Verified contract">✓</span>
            )}
          </span>
        </Field>
        <Field label="Amount">
          <span className="font-mono text-text-secondary">
            {action.token.amount} {action.token.symbol}
          </span>
        </Field>
        <Field label="Est. gas">
          <span className="font-mono text-text-secondary">{action.estimatedGas}</span>
        </Field>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-text-muted">{label}:</span>
      {children}
    </div>
  );
}

function PreflightRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2 text-sm last:border-b-0">
      <span className="text-text-muted">{label}</span>
      <span className={`text-text-primary ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}

function StepStatusIcon({ status, small }: { status: SimStepStatus; small?: boolean }) {
  const size = small ? "h-3.5 w-3.5" : "h-4 w-4";
  if (status === "passed") {
    return (
      <span className={`flex ${size} shrink-0 items-center justify-center rounded-full bg-success-dim text-success`}>
        <svg width="60%" height="60%" viewBox="0 0 14 14" fill="none">
          <path d="M2 7.5L5.2 10.5L12 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  if (status === "running") {
    return <span className={`${size} shrink-0 rounded-full border-2 border-accent border-t-transparent spin-slow`} />;
  }
  if (status === "failed") {
    return (
      <span className={`flex ${size} shrink-0 items-center justify-center rounded-full bg-danger-dim text-danger`}>
        <svg width="60%" height="60%" viewBox="0 0 14 14" fill="none">
          <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
    );
  }
  return <span className={`${size} shrink-0 rounded-full border border-border-strong`} />;
}
