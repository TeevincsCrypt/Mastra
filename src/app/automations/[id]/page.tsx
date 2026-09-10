"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useHydrated } from "@/lib/useHydrated";
import { useWallet } from "@/lib/useWallet";
import { useAuth } from "@/lib/useAuth";
import { PageShell, PageHeader } from "@/components/PageShell";
import { StatusPill } from "@/components/StatusPill";
import { shortHash } from "@/lib/format";
import type { Automation, Policy, ExecutionRecord, AuditEvent } from "@/lib/store/types";

const STAGE_ORDER = [
  "TRIGGER_RECEIVED",
  "WAYFINDER_QUOTE_REQUESTED",
  "QUOTE_RECEIVED",
  "POLICY_EVALUATION",
  "KEEPERHUB_PREFLIGHT",
  "APPROVAL_VERIFIED",
  "KEEPERHUB_EXECUTION_STARTED",
  "TRANSACTION_CONFIRMED",
  "EXECUTION_COMPLETE",
];

export default function AutomationDetailPage() {
  const hydrated = useHydrated();
  const params = useParams<{ id: string }>();
  const { isConnected, connectWallet } = useWallet();
  const { authenticated, authenticatedAddress, signingIn, error: authError, signIn } = useAuth();

  const [automation, setAutomation] = useState<Automation | null>(null);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/automations/${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setAutomation(data.automation);
          setPolicy(data.policy);
          setExecutions(data.executions);
          setAuditEvents(data.auditEvents);
        }
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!hydrated) return null;

  const isOwner = automation && authenticatedAddress && automation.ownerAddress.toLowerCase() === authenticatedAddress.toLowerCase();
  const latestExecution = executions[0];
  const liveEvents = latestExecution ? auditEvents.filter((e) => e.executionId === latestExecution.id).sort((a, b) => a.timestamp - b.timestamp) : [];

  async function handleExecute() {
    setRunning(true);
    setRunError(null);
    try {
      const res = await fetch(`/api/automations/${params.id}/execute`, { method: "POST" });
      const data = await res.json();
      if (!res.ok && !data.execution) {
        setRunError(data.error ?? "Execution failed.");
      }
      load();
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setRunning(false);
    }
  }

  async function handleActivateToggle() {
    if (!automation) return;
    const path = automation.status === "active" ? "pause" : "activate";
    await fetch(`/api/automations/${automation.id}/${path}`, { method: "POST" });
    load();
  }

  if (loading) return <PageShell><div className="card px-6 py-10 text-center text-sm text-text-muted">Loading…</div></PageShell>;
  if (!automation) return <PageShell><div className="card px-6 py-10 text-center text-sm text-danger">Automation not found.</div></PageShell>;

  const statusTone =
    automation.status === "active" ? "success" : automation.status === "blocked" || automation.status === "failed" ? "danger" : automation.status === "paused" ? "warning" : "neutral";

  return (
    <PageShell>
      <PageHeader
        eyebrow="Execution Center"
        title={automation.name}
        description={`${automation.amount} ${automation.fromToken} → ${automation.toToken} · ${automation.frequency} · ${automation.triggerDescription}`}
        action={<StatusPill tone={statusTone} dot>{automation.status.replace("_", " ").toUpperCase()}</StatusPill>}
      />

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col gap-6">
          <div className="card p-6">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-text-primary">Run this automation</span>
              {!automation.triggerLive && <StatusPill tone="warning" dot>Configured trigger — manual run</StatusPill>}
            </div>

            {!isConnected ? (
              <button onClick={connectWallet} className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white">Connect Wallet</button>
            ) : !authenticated ? (
              <div className="flex flex-col gap-2">
                <button onClick={signIn} disabled={signingIn} className="w-fit rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                  {signingIn ? "Waiting for signature…" : "Sign in to run automations"}
                </button>
                {authError && <p className="text-xs text-danger">{authError}</p>}
              </div>
            ) : !isOwner ? (
              <p className="text-sm text-text-muted">Only {shortHash(automation.ownerAddress, 6, 4)} (this automation&apos;s creator) can run it.</p>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <button onClick={handleExecute} disabled={running} className="rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">
                    {running ? "Running…" : "Execute now"}
                  </button>
                  <button onClick={handleActivateToggle} className="rounded-lg border border-border-strong px-5 py-2.5 text-sm font-medium text-text-secondary">
                    {automation.status === "active" ? "Pause" : "Activate"}
                  </button>
                </div>
                {runError && <p className="text-xs text-danger">{runError}</p>}
              </div>
            )}
          </div>

          {latestExecution && (
            <div className="card p-6">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-text-primary">Latest execution</span>
                <ExecutionStatusPill status={latestExecution.status} />
              </div>

              {latestExecution.status === "blocked" ? (
                <div className="flex flex-col gap-2">
                  <div className="rounded-lg border border-danger/30 bg-danger-dim px-4 py-3 text-sm text-danger">
                    <div className="font-semibold">EXECUTION BLOCKED</div>
                    <div className="mt-1">{latestExecution.error}</div>
                  </div>
                  <p className="text-xs text-text-muted">KeeperHub was NOT called. Mastra controls the agent — the agent does not control the money.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {STAGE_ORDER.map((stage) => {
                    const event = liveEvents.find((e) => e.type === stage);
                    return <StepLine key={stage} label={stage.replace(/_/g, " ")} done={Boolean(event)} time={event?.timestamp} />;
                  })}
                </div>
              )}

              {latestExecution.txHash && (
                <a
                  href={`https://etherscan.io/tx/${latestExecution.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 text-sm font-medium text-accent-strong hover:border-accent/50"
                >
                  <span className="font-mono text-xs">{shortHash(latestExecution.txHash, 10, 8)}</span>
                  <span>View on Etherscan →</span>
                </a>
              )}
              {latestExecution.error && latestExecution.status !== "blocked" && <p className="mt-2 text-xs text-danger">{latestExecution.error}</p>}
            </div>
          )}

          <div className="card overflow-hidden">
            <div className="border-b border-border px-5 py-3 text-xs font-semibold uppercase tracking-widest text-text-muted">Execution history</div>
            {executions.length === 0 ? (
              <div className="px-5 py-6 text-center text-sm text-text-muted">No executions yet.</div>
            ) : (
              executions.map((e, i) => <ExecutionRow key={e.id} execution={e} last={i === executions.length - 1} />)
            )}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {policy && (
            <div className="card p-6">
              <div className="mb-3 text-sm font-semibold text-text-primary">Policy</div>
              <div className="flex flex-col gap-2 text-sm">
                <Row label="Max / execution" value={`${policy.maxExecutionAmount} ${automation.fromToken}`} />
                <Row label="Daily limit" value={`${policy.dailyLimitAmount} ${automation.fromToken}`} />
                <Row label="Monthly limit" value={`${policy.monthlyLimitAmount} ${automation.fromToken}`} />
                <Row label="Max slippage" value={`${policy.maxSlippageBps}bps`} />
                <Row label="Allowed chains" value={policy.allowedChains.join(", ")} />
                <Row label="Allowed routers" value={shortHash(policy.allowedRouters[0] ?? "", 6, 4)} />
              </div>
            </div>
          )}

          <div className="card overflow-hidden">
            <div className="border-b border-border px-5 py-3 text-xs font-semibold uppercase tracking-widest text-text-muted">Audit trail</div>
            <div className="max-h-[420px] overflow-y-auto">
              {auditEvents.length === 0 ? (
                <div className="px-5 py-6 text-center text-sm text-text-muted">No events yet.</div>
              ) : (
                auditEvents.map((e, i) => <AuditRow key={e.id} event={e} last={i === auditEvents.length - 1} />)
              )}
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function StepLine({ label, done, time }: { label: string; done: boolean; time?: number }) {
  return (
    <div className="flex items-center gap-2.5 text-sm">
      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${done ? "bg-success-dim text-success" : "border border-border-strong text-transparent"}`}>
        {done && (
          <svg width="9" height="9" viewBox="0 0 14 14" fill="none">
            <path d="M2 7.5L5.2 10.5L12 3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className={done ? "text-text-primary" : "text-text-muted"}>{label}</span>
      {time && <span className="ml-auto text-[10px] text-text-muted">{new Date(time).toLocaleTimeString()}</span>}
    </div>
  );
}

function ExecutionStatusPill({ status }: { status: ExecutionRecord["status"] }) {
  const tone = status === "success" ? "success" : status === "blocked" || status === "failed" || status === "reverted" ? "danger" : "warning";
  return <StatusPill tone={tone} dot pulse={status === "preparing" || status === "executing"}>{status.toUpperCase()}</StatusPill>;
}

function ExecutionRow({ execution, last }: { execution: ExecutionRecord; last?: boolean }) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm ${last ? "" : "border-b border-border"}`}>
      <div className="flex items-center gap-3">
        <ExecutionStatusPill status={execution.status} />
        <span className="text-text-secondary">
          {execution.requestedAmount} {execution.fromToken} → {execution.toToken}
        </span>
        <span className="text-xs text-text-muted">{new Date(execution.createdAt).toLocaleString()}</span>
      </div>
      {execution.txHash ? (
        <a href={`https://etherscan.io/tx/${execution.txHash}`} target="_blank" rel="noreferrer" className="font-mono text-xs text-accent-strong hover:underline">
          {shortHash(execution.txHash, 6, 4)}
        </a>
      ) : (
        <span className="max-w-xs truncate text-xs text-text-muted">{execution.error ?? "—"}</span>
      )}
    </div>
  );
}

function AuditRow({ event, last }: { event: AuditEvent; last?: boolean }) {
  return (
    <div className={`px-5 py-2.5 text-xs ${last ? "" : "border-b border-border"}`}>
      <div className="flex items-center justify-between">
        <span className="font-mono font-medium text-text-primary">{event.type}</span>
        <span className="text-text-muted">{new Date(event.timestamp).toLocaleTimeString()}</span>
      </div>
      <div className="mt-0.5 text-text-secondary">{event.message}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-1.5 text-sm last:border-b-0">
      <span className="shrink-0 text-text-muted">{label}</span>
      <span className="text-right font-mono text-xs text-text-primary">{value}</span>
    </div>
  );
}
