"use client";

import { useEffect, useState } from "react";
import { useHydrated } from "@/lib/useHydrated";
import { PageShell, PageHeader } from "@/components/PageShell";
import { StatusPill } from "@/components/StatusPill";
import { shortHash } from "@/lib/format";
import type { Automation, ExecutionRecord } from "@/lib/store/types";

interface HealthEntry {
  status: "connected" | "degraded" | "offline" | "not_configured";
  detail?: string;
}

interface WalletState {
  executionWallet: string;
  balances: Record<string, string>;
  ethBalanceWei?: string;
  ethBalanceLow?: boolean;
}

function formatEth(wei: string): string {
  return (Number(wei) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 6 });
}

/**
 * Integrations: the real KeeperHub execution wallet + its real on-chain
 * balances, the real recent workflow executions KeeperHub ran, and a live
 * Wayfinder quote/token-resolve tester hitting the actual MCP integration.
 * No credentials are ever rendered — only public wallet/tx data and the
 * responses of read-only calls.
 */
export default function IntegrationsPage() {
  const hydrated = useHydrated();

  const [keeperhubHealth, setKeeperhubHealth] = useState<HealthEntry | null>(null);
  const [wayfinderHealth, setWayfinderHealth] = useState<HealthEntry | null>(null);

  const [walletState, setWalletState] = useState<WalletState | null>(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [walletError, setWalletError] = useState<string | null>(null);

  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
  const [executionsLoading, setExecutionsLoading] = useState(true);

  const [fromToken, setFromToken] = useState("usd-coin-ethereum");
  const [toToken, setToToken] = useState("weth-ethereum");
  const [quoteAmount, setQuoteAmount] = useState("10.0");
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteResult, setQuoteResult] = useState<unknown>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const [resolveQuery, setResolveQuery] = useState("usd-coin-ethereum");
  const [resolveLoading, setResolveLoading] = useState(false);
  const [resolveResult, setResolveResult] = useState<unknown>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/system/health")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setKeeperhubHealth(data.keeperhub);
          setWayfinderHealth(data.wayfinder);
        }
      });

    fetch("/api/keeperhub/mainnet-wallet-state")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setWalletState(data);
        else setWalletError(data.error ?? "Could not read execution wallet state.");
      })
      .catch((err) => setWalletError(err instanceof Error ? err.message : "Request failed."))
      .finally(() => setWalletLoading(false));

    fetch("/api/automations")
      .then((r) => r.json())
      .then(async (data) => {
        if (!data.ok) return;
        const all: ExecutionRecord[] = [];
        for (const automation of data.automations as Automation[]) {
          const detail = await fetch(`/api/automations/${automation.id}`).then((r) => r.json());
          if (detail.ok) all.push(...(detail.executions as ExecutionRecord[]));
        }
        all.sort((a, b) => b.createdAt - a.createdAt);
        setExecutions(all.slice(0, 12));
      })
      .finally(() => setExecutionsLoading(false));
  }, []);

  async function runQuote() {
    setQuoteLoading(true);
    setQuoteError(null);
    setQuoteResult(null);
    try {
      const res = await fetch("/api/wayfinder/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromToken, toToken, amount: quoteAmount }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) setQuoteError(data.error ?? `Request failed (${res.status}).`);
      else setQuoteResult(data.quote);
    } catch (err) {
      setQuoteError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setQuoteLoading(false);
    }
  }

  async function runResolve() {
    setResolveLoading(true);
    setResolveError(null);
    setResolveResult(null);
    try {
      const res = await fetch("/api/wayfinder/resolve-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: resolveQuery }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) setResolveError(data.error ?? `Request failed (${res.status}).`);
      else setResolveResult(data.result);
    } catch (err) {
      setResolveError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setResolveLoading(false);
    }
  }

  if (!hydrated) return null;

  return (
    <PageShell>
      <PageHeader
        eyebrow="External integrations"
        title="Integrations"
        description="The two real systems Mastra sits between: Wayfinder finds the route, KeeperHub is the only thing that ever signs. Everything on this page is a live call to one of them — no fabricated data."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* KeeperHub */}
        <div className="flex flex-col gap-4">
          <div className="card p-6">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-text-primary">KeeperHub</span>
              <HealthPill entry={keeperhubHealth} />
            </div>
            <p className="mb-4 text-xs text-text-secondary">
              The only wallet that ever signs a real transaction. Mastra never holds or requests its private key — every call goes through
              KeeperHub&apos;s own API.
            </p>
            {walletLoading ? (
              <div className="text-xs text-text-muted">Reading execution wallet…</div>
            ) : walletError ? (
              <div className="text-xs text-danger">{walletError}</div>
            ) : walletState ? (
              <div className="flex flex-col gap-2">
                <Row label="Execution wallet" value={shortHash(walletState.executionWallet, 8, 6)} />
                {walletState.ethBalanceWei != null && (
                  <>
                    <Row label="ETH balance (gas budget)" value={`${formatEth(walletState.ethBalanceWei)} ETH`} />
                    {walletState.ethBalanceLow && (
                      <div className="rounded-lg border border-danger/30 bg-danger-dim px-3 py-2 text-[11px] text-danger">
                        Low ETH — real executions can fail with INSUFFICIENT_FUNDS before a transaction is even broadcast.
                        Send more ETH to the execution wallet above.
                      </div>
                    )}
                  </>
                )}
                {Object.entries(walletState.balances).map(([symbol, raw]) => (
                  <Row key={symbol} label={`${symbol} balance (raw)`} value={raw} />
                ))}
              </div>
            ) : null}
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-border px-5 py-3 text-xs font-semibold uppercase tracking-widest text-text-muted">
              Recent workflow executions
            </div>
            {executionsLoading ? (
              <div className="px-5 py-6 text-center text-sm text-text-muted">Loading…</div>
            ) : executions.length === 0 ? (
              <div className="px-5 py-6 text-center text-sm text-text-muted">No executions yet.</div>
            ) : (
              executions.map((e, i) => <WorkflowRow key={e.id} execution={e} last={i === executions.length - 1} />)
            )}
          </div>
        </div>

        {/* Wayfinder */}
        <div className="flex flex-col gap-4">
          <div className="card p-6">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-text-primary">Wayfinder</span>
              <HealthPill entry={wayfinderHealth} />
            </div>
            <p className="mb-4 text-xs text-text-secondary">
              Quote-only. Wayfinder finds the best route and returns real calldata — it never signs or moves funds.
            </p>

            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-xs text-text-secondary">
                  From token
                  <input value={fromToken} onChange={(e) => setFromToken(e.target.value)} className="rounded-lg border border-border-strong bg-transparent px-2.5 py-2 text-xs text-text-primary" />
                </label>
                <label className="flex flex-col gap-1 text-xs text-text-secondary">
                  To token
                  <input value={toToken} onChange={(e) => setToToken(e.target.value)} className="rounded-lg border border-border-strong bg-transparent px-2.5 py-2 text-xs text-text-primary" />
                </label>
              </div>
              <div className="flex items-end gap-2">
                <label className="flex flex-1 flex-col gap-1 text-xs text-text-secondary">
                  Amount
                  <input value={quoteAmount} onChange={(e) => setQuoteAmount(e.target.value)} className="rounded-lg border border-border-strong bg-transparent px-2.5 py-2 text-xs text-text-primary" />
                </label>
                <button onClick={runQuote} disabled={quoteLoading} className="rounded-lg bg-wayfinder-dim px-4 py-2 text-xs font-semibold text-wayfinder disabled:opacity-60">
                  {quoteLoading ? "Quoting…" : "Get live quote"}
                </button>
              </div>
              {quoteError && <p className="text-xs text-danger">{quoteError}</p>}
              {quoteResult != null && (
                <pre className="max-h-56 overflow-auto rounded-lg border border-border bg-surface px-3 py-2.5 text-[10px] leading-relaxed text-text-secondary">
                  {JSON.stringify(quoteResult, null, 2)}
                </pre>
              )}
            </div>
          </div>

          <div className="card p-6">
            <div className="mb-3 text-sm font-semibold text-text-primary">Resolve a token</div>
            <div className="flex items-end gap-2">
              <label className="flex flex-1 flex-col gap-1 text-xs text-text-secondary">
                Query
                <input value={resolveQuery} onChange={(e) => setResolveQuery(e.target.value)} className="rounded-lg border border-border-strong bg-transparent px-2.5 py-2 text-xs text-text-primary" />
              </label>
              <button onClick={runResolve} disabled={resolveLoading} className="rounded-lg bg-wayfinder-dim px-4 py-2 text-xs font-semibold text-wayfinder disabled:opacity-60">
                {resolveLoading ? "Resolving…" : "Resolve"}
              </button>
            </div>
            {resolveError && <p className="mt-2 text-xs text-danger">{resolveError}</p>}
            {resolveResult != null && (
              <pre className="mt-3 max-h-56 overflow-auto rounded-lg border border-border bg-surface px-3 py-2.5 text-[10px] leading-relaxed text-text-secondary">
                {JSON.stringify(resolveResult, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function HealthPill({ entry }: { entry: HealthEntry | null }) {
  if (!entry) return <span className="h-4 w-20 animate-pulse rounded bg-surface-hover" />;
  const tone = entry.status === "connected" ? "success" : entry.status === "not_configured" ? "warning" : entry.status === "degraded" ? "warning" : "danger";
  const text = entry.status.replace("_", " ").toUpperCase();
  return <StatusPill tone={tone} dot>{text}</StatusPill>;
}

function WorkflowRow({ execution, last }: { execution: ExecutionRecord; last?: boolean }) {
  const tone = execution.status === "success" ? "success" : execution.status === "blocked" || execution.status === "failed" || execution.status === "reverted" ? "danger" : "warning";
  return (
    <div className={`px-5 py-3 text-xs ${last ? "" : "border-b border-border"}`}>
      <div className="flex items-center justify-between gap-2">
        <StatusPill tone={tone} dot>{execution.status.toUpperCase()}</StatusPill>
        <span className="text-text-muted">{new Date(execution.createdAt).toLocaleString()}</span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-text-secondary">
        <span>
          {execution.requestedAmount} {execution.fromToken} → {execution.toToken}
        </span>
        {execution.keeperhubWorkflowId && <span className="font-mono">workflow: {shortHash(execution.keeperhubWorkflowId, 6, 4)}</span>}
        {execution.keeperhubExecutionId && <span className="font-mono">execution: {shortHash(execution.keeperhubExecutionId, 6, 4)}</span>}
        {execution.gasUsed && <span>gas: {execution.gasUsed}</span>}
        {execution.approvalHash && <span className="font-mono">approval: {shortHash(execution.approvalHash, 6, 4)}</span>}
      </div>
      {execution.txHash && (
        <a href={`https://etherscan.io/tx/${execution.txHash}`} target="_blank" rel="noreferrer" className="mt-1 inline-block font-mono text-accent-strong hover:underline">
          {shortHash(execution.txHash, 8, 6)} ↗
        </a>
      )}
      {!execution.keeperhubExecuteCalled && (
        <div className="mt-1 text-danger">KeeperHub was NOT called — blocked before execution.</div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-1.5 text-xs last:border-b-0">
      <span className="shrink-0 text-text-muted">{label}</span>
      <span className="text-right font-mono text-text-primary">{value}</span>
    </div>
  );
}
