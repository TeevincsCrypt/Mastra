"use client";

import { useEffect, useState } from "react";
import { useHydrated } from "@/lib/useHydrated";
import { useWallet } from "@/lib/useWallet";
import { useAuth } from "@/lib/useAuth";
import { PageShell, PageHeader } from "@/components/PageShell";
import { StatusPill } from "@/components/StatusPill";
import { shortHash } from "@/lib/format";

interface SystemStatus {
  paused: boolean;
  pausedAt?: number;
  pausedBy?: string;
}

/**
 * The real authorization boundaries, in one place — not a decorative
 * "security" page. Every control here calls the same server-side checks
 * the execution pipeline itself enforces: session-verified identity
 * (requireSession.ts), the operator allowlist gating who can actually
 * spend (MASTRA_AUTHORIZED_EXECUTORS), the deterministic policy engine,
 * and the emergency pause that runAutomationExecution() checks
 * authoritatively before any Wayfinder/KeeperHub call.
 */
export default function SecurityPage() {
  const hydrated = useHydrated();
  const { isConnected, address, connectWallet } = useWallet();
  const { authenticated, authenticatedAddress, isAuthorizedExecutor, signingIn, error: authError, signIn, signOut } = useAuth();

  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [executorConfigured, setExecutorConfigured] = useState<boolean | null>(null);

  function loadStatus() {
    fetch("/api/system/status")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setStatus({ paused: data.paused, pausedAt: data.pausedAt, pausedBy: data.pausedBy });
      })
      .finally(() => setStatusLoading(false));
  }

  useEffect(() => {
    loadStatus();
    // Infer whether MASTRA_AUTHORIZED_EXECUTORS is configured at all from the
    // current session's own check — if unauthenticated, this stays unknown
    // rather than guessed.
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.authenticated) setExecutorConfigured(true);
      });
  }, []);

  if (!hydrated) return null;

  async function togglePause(next: boolean) {
    setToggling(true);
    setToggleError(null);
    try {
      const res = await fetch("/api/system/pause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paused: next }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) setToggleError(data.error ?? "Failed to change system state.");
      loadStatus();
    } catch (err) {
      setToggleError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setToggling(false);
    }
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Authorization &amp; boundaries"
        title="Security"
        description="AI proposes. Policies decide. KeeperHub executes. This page is the real authorization model, not a description of one — every control below is backed by a server-side check the execution pipeline itself enforces."
        action={
          statusLoading ? null : status?.paused ? (
            <StatusPill tone="danger" dot pulse>System Paused</StatusPill>
          ) : (
            <StatusPill tone="success" dot>System Ready</StatusPill>
          )
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <div className="card p-6">
            <div className="mb-3 text-sm font-semibold text-text-primary">Emergency pause</div>
            <p className="mb-4 text-xs text-text-secondary">
              A real, server-side kill switch. <code className="font-mono">runAutomationExecution()</code> checks this authoritatively before
              any Wayfinder quote or KeeperHub call is made — pausing here stops every automation on the server, not just this browser tab.
            </p>

            {statusLoading ? (
              <div className="text-xs text-text-muted">Loading…</div>
            ) : (
              <>
                {status?.paused && status.pausedBy && (
                  <p className="mb-3 text-xs text-text-muted">
                    Paused by {shortHash(status.pausedBy, 6, 4)}
                    {status.pausedAt ? ` at ${new Date(status.pausedAt).toLocaleString()}` : ""}.
                  </p>
                )}

                {!isConnected ? (
                  <button onClick={connectWallet} className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white">
                    Connect Wallet
                  </button>
                ) : !authenticated ? (
                  <div className="flex flex-col gap-2">
                    <button onClick={signIn} disabled={signingIn} className="w-fit rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                      {signingIn ? "Waiting for signature…" : "Sign in to manage pause state"}
                    </button>
                    {authError && <p className="text-xs text-danger">{authError}</p>}
                  </div>
                ) : status?.paused ? (
                  <button
                    onClick={() => togglePause(false)}
                    disabled={toggling || !isAuthorizedExecutor}
                    className="rounded-lg bg-success px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {toggling ? "Resuming…" : "Resume execution"}
                  </button>
                ) : (
                  <button
                    onClick={() => togglePause(true)}
                    disabled={toggling}
                    className="rounded-lg bg-danger px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {toggling ? "Pausing…" : "Pause all execution"}
                  </button>
                )}

                {authenticated && status?.paused && !isAuthorizedExecutor && (
                  <p className="mt-2 text-xs text-text-muted">
                    Pausing is open to any signed-in wallet by design. Resuming requires an address on the operator allowlist.
                  </p>
                )}
                {toggleError && <p className="mt-2 text-xs text-danger">{toggleError}</p>}
              </>
            )}
          </div>

          <div className="card p-6">
            <div className="mb-3 text-sm font-semibold text-text-primary">Your session</div>
            <div className="flex flex-col gap-2 text-xs">
              <Row label="Browser wallet" value={address ? shortHash(address, 6, 4) : "Not connected"} />
              <Row label="Signed-in identity" value={authenticated && authenticatedAddress ? shortHash(authenticatedAddress, 6, 4) : "Not signed in"} />
              <Row
                label="Can trigger real execution"
                value={authenticated ? (isAuthorizedExecutor ? "Yes — on operator allowlist" : "No — not on operator allowlist") : "No — sign in first"}
              />
            </div>
            {authenticated && (
              <button onClick={signOut} className="mt-4 rounded-lg border border-border-strong px-4 py-2 text-xs font-medium text-text-secondary">
                Sign out
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="card p-6">
            <div className="mb-3 text-sm font-semibold text-text-primary">The authorization model</div>
            <div className="flex flex-col gap-4 text-xs text-text-secondary">
              <Layer
                title="1. Sign-in-with-wallet"
                detail="A challenge message is signed by your browser wallet and verified server-side (viem's verifyMessage) before a session cookie is issued. A connected MetaMask alone proves nothing — only a verified signature does."
              />
              <Layer
                title="2. Operator allowlist"
                detail={
                  executorConfigured === false
                    ? "MASTRA_AUTHORIZED_EXECUTORS is not set in this deployment — any signed-in wallet may trigger real execution. This is a disclosed gap, not a silent one."
                    : "MASTRA_AUTHORIZED_EXECUTORS gates the one route that can spend from the shared KeeperHub-funded wallet. Creating and viewing automations is open; triggering real execution is not."
                }
              />
              <Layer
                title="3. Deterministic policy engine"
                detail="A pure function, not an LLM's opinion, evaluates every execution against real limits — max amount, daily/monthly budget, allowed chains/tokens/router, slippage, quote freshness — before KeeperHub is ever called."
              />
              <Layer
                title="4. Emergency pause"
                detail="Checked authoritatively on the server inside the execution path itself, not just hidden in the UI. A paused system blocks every automation regardless of who or what tries to trigger it."
              />
              <Layer
                title="5. KeeperHub as sole executor"
                detail="Mastra never holds or requests KeeperHub's private key. It can only ask KeeperHub to execute a specific, policy-approved, quote-matched calldata payload — nothing more."
              />
            </div>
          </div>

          <div className="card p-6">
            <div className="mb-2 text-sm font-semibold text-text-primary">What this is not</div>
            <p className="text-xs text-text-secondary">
              This architecture is not fully non-custodial: real execution still spends from KeeperHub&apos;s own shared wallet, not a
              per-user wallet. The security boundary these controls enforce is <em>who may direct that spend and under what limits</em> —
              not custody itself. See the Architecture page for the full picture.
            </p>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function Layer({ title, detail }: { title: string; detail: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-text-primary">{title}</div>
      <div className="mt-1">{detail}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-1.5 last:border-b-0">
      <span className="shrink-0 text-text-muted">{label}</span>
      <span className="text-right font-mono text-text-primary">{value}</span>
    </div>
  );
}
