"use client";

import { useState } from "react";

/**
 * Diagnostic-only page for exercising the real Wayfinder MCP integration in
 * isolation. Deliberately not linked from Nav and not part of the main
 * Dashboard -> Workflow Review -> Execute flow — wiring a real quote into
 * that flow without matching dynamic KeeperHub execution would display real
 * data next to an execution that doesn't match it, which is exactly the
 * misleading state this build avoids. Reachable only by typing the URL.
 */
export default function WayfinderTestPage() {
  const [fromToken, setFromToken] = useState("usdc-ethereum");
  const [toToken, setToToken] = useState("weth-ethereum");
  const [amount, setAmount] = useState("10.0");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  async function runQuote() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/wayfinder/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromToken, toToken, amount }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? `Request failed (${res.status}).`);
      } else {
        setResult(data.quote);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 text-text-primary">
      <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-muted">Diagnostic — not part of the main flow</div>
      <h1 className="text-2xl font-semibold tracking-tight">Wayfinder MCP quote test</h1>
      <p className="mt-2 text-sm text-text-secondary">
        Calls <code className="font-mono">/api/wayfinder/quote</code> → the real, unmodified{" "}
        <code className="font-mono">onchain_quote_swap</code> tool on your deployed{" "}
        <code className="font-mono">wayfinder-service</code>. Requires <code className="font-mono">WAYFINDER_MCP_URL</code> to
        be set. This page never touches KeeperHub or execution — it only proves the Wayfinder quote path works.
      </p>

      <div className="card mt-6 flex flex-col gap-3 p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            From token
            <input
              value={fromToken}
              onChange={(e) => setFromToken(e.target.value)}
              className="rounded-lg border border-border-strong bg-transparent px-3 py-2 text-sm text-text-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            To token
            <input
              value={toToken}
              onChange={(e) => setToToken(e.target.value)}
              className="rounded-lg border border-border-strong bg-transparent px-3 py-2 text-sm text-text-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            Amount
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="rounded-lg border border-border-strong bg-transparent px-3 py-2 text-sm text-text-primary"
            />
          </label>
        </div>
        <button
          onClick={runQuote}
          disabled={loading}
          className="w-fit rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Requesting…" : "Get real Wayfinder quote"}
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-danger/30 bg-danger-dim px-4 py-3 text-sm text-danger">{error}</div>
      )}

      {result != null && (
        <pre className="mt-4 overflow-x-auto rounded-lg border border-border bg-surface p-4 text-xs text-text-secondary">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
