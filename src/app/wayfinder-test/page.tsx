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
  const [fromToken, setFromToken] = useState("usd-coin-ethereum");
  const [toToken, setToToken] = useState("weth-ethereum");
  const [amount, setAmount] = useState("10.0");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  const [resolveQuery, setResolveQuery] = useState("usd-coin-ethereum");
  const [resolveLoading, setResolveLoading] = useState(false);
  const [resolveResult, setResolveResult] = useState<unknown>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const [validateAmount, setValidateAmount] = useState("1.5");
  const [validateLoading, setValidateLoading] = useState(false);
  const [validateResult, setValidateResult] = useState<unknown>(null);
  const [validateError, setValidateError] = useState<string | null>(null);

  const [diagnoseWorkflowId, setDiagnoseWorkflowId] = useState("xt0w6n7m8o6u5419lz9iz");
  const [diagnoseLoading, setDiagnoseLoading] = useState(false);
  const [diagnoseResult, setDiagnoseResult] = useState<unknown>(null);
  const [diagnoseError, setDiagnoseError] = useState<string | null>(null);

  const [prepareAmount, setPrepareAmount] = useState("1.2");
  const [prepareSlippageBps, setPrepareSlippageBps] = useState("50");
  const [prepareLoading, setPrepareLoading] = useState(false);
  const [prepareResult, setPrepareResult] = useState<unknown>(null);
  const [prepareError, setPrepareError] = useState<string | null>(null);

  const [executeWorkflowId, setExecuteWorkflowId] = useState("");
  const [executeApprovedHash, setExecuteApprovedHash] = useState("");
  const [executeConfirmText, setExecuteConfirmText] = useState("");
  const [executeLoading, setExecuteLoading] = useState(false);
  const [executeResult, setExecuteResult] = useState<unknown>(null);
  const [executeError, setExecuteError] = useState<string | null>(null);

  const [forensicsTxHash, setForensicsTxHash] = useState("");
  const [forensicsWorkflowId, setForensicsWorkflowId] = useState("");
  const [forensicsLoading, setForensicsLoading] = useState(false);
  const [forensicsResult, setForensicsResult] = useState<unknown>(null);
  const [forensicsError, setForensicsError] = useState<string | null>(null);

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

  async function runValidate() {
    setValidateLoading(true);
    setValidateError(null);
    setValidateResult(null);
    try {
      const res = await fetch("/api/keeperhub/validate-mainnet-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromToken: "usd-coin-ethereum", toToken: "weth-ethereum", amount: validateAmount }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setValidateError(JSON.stringify(data, null, 2));
      } else {
        setValidateResult(data);
      }
    } catch (err) {
      setValidateError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setValidateLoading(false);
    }
  }

  async function runDiagnose() {
    setDiagnoseLoading(true);
    setDiagnoseError(null);
    setDiagnoseResult(null);
    try {
      const res = await fetch("/api/keeperhub/diagnose-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowId: diagnoseWorkflowId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDiagnoseError(JSON.stringify(data, null, 2));
      } else {
        setDiagnoseResult(data);
      }
    } catch (err) {
      setDiagnoseError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setDiagnoseLoading(false);
    }
  }

  async function runPrepare() {
    setPrepareLoading(true);
    setPrepareError(null);
    setPrepareResult(null);
    try {
      const res = await fetch("/api/keeperhub/prepare-mainnet-swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromToken: "usd-coin-ethereum",
          toToken: "weth-ethereum",
          amount: prepareAmount,
          slippageBps: prepareSlippageBps ? Number(prepareSlippageBps) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setPrepareError(JSON.stringify(data, null, 2));
      } else {
        setPrepareResult(data);
      }
    } catch (err) {
      setPrepareError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setPrepareLoading(false);
    }
  }

  async function runExecute() {
    if (executeConfirmText !== "EXECUTE") return;
    setExecuteLoading(true);
    setExecuteError(null);
    setExecuteResult(null);
    try {
      const res = await fetch("/api/keeperhub/execute-mainnet-swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowId: executeWorkflowId, approvedHash: executeApprovedHash }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setExecuteError(JSON.stringify(data, null, 2));
      } else {
        setExecuteResult(data);
      }
    } catch (err) {
      setExecuteError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setExecuteLoading(false);
    }
  }

  async function runForensics() {
    setForensicsLoading(true);
    setForensicsError(null);
    setForensicsResult(null);
    try {
      const res = await fetch("/api/keeperhub/forensics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash: forensicsTxHash, workflowId: forensicsWorkflowId || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setForensicsError(JSON.stringify(data, null, 2));
      } else {
        setForensicsResult(data);
      }
    } catch (err) {
      setForensicsError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setForensicsLoading(false);
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
      if (!res.ok || !data.ok) {
        setResolveError(data.error ?? `Request failed (${res.status}).`);
      } else {
        setResolveResult(data.result);
      }
    } catch (err) {
      setResolveError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setResolveLoading(false);
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

      <div className="mt-10 border-t border-border pt-8">
        <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-muted">
          Diagnostic — token resolution only
        </div>
        <h2 className="text-lg font-semibold tracking-tight">Resolve token (HTTP status diagnostic)</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Calls the SDK&apos;s read-only <code className="font-mono">onchain_resolve_token</code> tool. Unlike a failed
          quote — which discards the underlying HTTP status — this tool&apos;s own error handling preserves it, so use
          this when a quote fails to see the real status code instead of guessing.
        </p>

        <div className="card mt-4 flex flex-col gap-3 p-5">
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            Token query
            <input
              value={resolveQuery}
              onChange={(e) => setResolveQuery(e.target.value)}
              className="rounded-lg border border-border-strong bg-transparent px-3 py-2 text-sm text-text-primary"
            />
          </label>
          <button
            onClick={runResolve}
            disabled={resolveLoading}
            className="w-fit rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {resolveLoading ? "Requesting…" : "Resolve token"}
          </button>
        </div>

        {resolveError && (
          <div className="mt-4 rounded-lg border border-danger/30 bg-danger-dim px-4 py-3 text-sm text-danger">
            {resolveError}
          </div>
        )}

        {resolveResult != null && (
          <pre className="mt-4 overflow-x-auto rounded-lg border border-border bg-surface p-4 text-xs text-text-secondary">
            {JSON.stringify(resolveResult, null, 2)}
          </pre>
        )}
      </div>

      <div className="mt-10 border-t border-danger/40 pt-8">
        <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-danger">
          Mainnet-facing — but non-executing
        </div>
        <h2 className="text-lg font-semibold tracking-tight">Validate KeeperHub dynamic-workflow schema</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Runs a real Ethereum mainnet Wayfinder quote (USDC → WETH), decodes the outer{" "}
          <code className="font-mono">execute(bytes,bytes[])</code> call, and attempts to{" "}
          <strong>create</strong> (never execute) a KeeperHub workflow using the decoded bytes verbatim. This never
          signs or broadcasts anything — it only tests whether KeeperHub&apos;s <code className="font-mono">web3/write-contract</code>{" "}
          schema accepts <code className="font-mono">bytes</code>/<code className="font-mono">bytes[]</code> functionArgs.
        </p>

        <div className="card mt-4 flex flex-col gap-3 p-5">
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            Amount (USDC, for the quote only)
            <input
              value={validateAmount}
              onChange={(e) => setValidateAmount(e.target.value)}
              className="rounded-lg border border-border-strong bg-transparent px-3 py-2 text-sm text-text-primary"
            />
          </label>
          <button
            onClick={runValidate}
            disabled={validateLoading}
            className="w-fit rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {validateLoading ? "Requesting…" : "Validate schema (creates workflow, does not execute)"}
          </button>
        </div>

        {validateError && (
          <pre className="mt-4 overflow-x-auto rounded-lg border border-danger/30 bg-danger-dim p-4 text-xs text-danger">
            {validateError}
          </pre>
        )}

        {validateResult != null && (
          <pre className="mt-4 overflow-x-auto rounded-lg border border-border bg-surface p-4 text-xs text-text-secondary">
            {JSON.stringify(validateResult, null, 2)}
          </pre>
        )}
      </div>

      <div className="mt-10 border-t border-border pt-8">
        <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-muted">
          Diagnostic — read-only, no execute/enable/update calls
        </div>
        <h2 className="text-lg font-semibold tracking-tight">Diagnose a stored KeeperHub workflow</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Re-fetches a stored workflow via <code className="font-mono">GET /api/workflows/&#123;id&#125;</code> and
          attempts <code className="font-mono">GET /api/user/wallet/balances</code> (not previously confirmed — this is
          the live test) to try to discover KeeperHub&apos;s actual execution wallet address. Only GET calls — nothing
          is executed, enabled, or updated.
        </p>

        <div className="card mt-4 flex flex-col gap-3 p-5">
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            Workflow ID
            <input
              value={diagnoseWorkflowId}
              onChange={(e) => setDiagnoseWorkflowId(e.target.value)}
              className="rounded-lg border border-border-strong bg-transparent px-3 py-2 text-sm text-text-primary"
            />
          </label>
          <button
            onClick={runDiagnose}
            disabled={diagnoseLoading}
            className="w-fit rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {diagnoseLoading ? "Requesting…" : "Diagnose (read-only)"}
          </button>
        </div>

        {diagnoseError && (
          <pre className="mt-4 overflow-x-auto rounded-lg border border-danger/30 bg-danger-dim p-4 text-xs text-danger">
            {diagnoseError}
          </pre>
        )}

        {diagnoseResult != null && (
          <pre className="mt-4 overflow-x-auto rounded-lg border border-border bg-surface p-4 text-xs text-text-secondary">
            {JSON.stringify(diagnoseResult, null, 2)}
          </pre>
        )}
      </div>

      <div className="mt-10 border-t border-danger/40 pt-8">
        <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-danger">
          Phase B — creates a real workflow, still never executes
        </div>
        <h2 className="text-lg font-semibold tracking-tight">Prepare real mainnet swap</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Real quote → decode → on-chain allowance check (read-only) → conditionally build{" "}
          <code className="font-mono">approve</code> + <code className="font-mono">execute</code> → creates the real
          KeeperHub workflow → computes the approval-hash security plan. This still never calls KeeperHub&apos;s{" "}
          <code className="font-mono">execute(workflowId)</code> — nothing is signed or broadcast.
        </p>

        <div className="card mt-4 flex flex-col gap-3 p-5">
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            Amount (USDC)
            <input
              value={prepareAmount}
              onChange={(e) => setPrepareAmount(e.target.value)}
              className="rounded-lg border border-border-strong bg-transparent px-3 py-2 text-sm text-text-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            Slippage tolerance (bps — 50 = 0.5%, default). Both reverted attempts used the default 50.
            <input
              value={prepareSlippageBps}
              onChange={(e) => setPrepareSlippageBps(e.target.value)}
              className="rounded-lg border border-border-strong bg-transparent px-3 py-2 text-sm text-text-primary"
            />
          </label>
          <button
            onClick={runPrepare}
            disabled={prepareLoading}
            className="w-fit rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {prepareLoading ? "Requesting…" : "Prepare (creates workflow, does not execute)"}
          </button>
        </div>

        {prepareError && (
          <pre className="mt-4 overflow-x-auto rounded-lg border border-danger/30 bg-danger-dim p-4 text-xs text-danger">
            {prepareError}
          </pre>
        )}

        {prepareResult != null && (
          <pre className="mt-4 overflow-x-auto rounded-lg border border-border bg-surface p-4 text-xs text-text-secondary">
            {JSON.stringify(prepareResult, null, 2)}
          </pre>
        )}
      </div>

      <div className="mt-10 border-t-4 border-danger pt-8">
        <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-danger">
          Phase D — sends REAL transactions and spends REAL funds
        </div>
        <h2 className="text-lg font-semibold tracking-tight">Execute mainnet swap</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Re-verifies the approval hash against what&apos;s actually stored in KeeperHub right now, refuses to proceed
          on any mismatch, and only then calls KeeperHub&apos;s real <code className="font-mono">execute(workflowId)</code>.
          This is irreversible once broadcast. Paste the exact <code className="font-mono">keeperhubWorkflowId</code> and{" "}
          <code className="font-mono">approvalHash</code> from a &quot;Prepare&quot; result above.
        </p>

        <div className="card mt-4 flex flex-col gap-3 p-5">
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            Workflow ID
            <input
              value={executeWorkflowId}
              onChange={(e) => setExecuteWorkflowId(e.target.value)}
              className="rounded-lg border border-border-strong bg-transparent px-3 py-2 text-sm text-text-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            Approved hash
            <input
              value={executeApprovedHash}
              onChange={(e) => setExecuteApprovedHash(e.target.value)}
              className="rounded-lg border border-border-strong bg-transparent px-3 py-2 text-sm text-text-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            Type EXECUTE to confirm
            <input
              value={executeConfirmText}
              onChange={(e) => setExecuteConfirmText(e.target.value)}
              placeholder="EXECUTE"
              className="rounded-lg border border-border-strong bg-transparent px-3 py-2 text-sm text-text-primary"
            />
          </label>
          <button
            onClick={runExecute}
            disabled={executeLoading || executeConfirmText !== "EXECUTE" || !executeWorkflowId || !executeApprovedHash}
            className="w-fit rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {executeLoading ? "Executing…" : "Execute real mainnet swap"}
          </button>
        </div>

        {executeError && (
          <pre className="mt-4 overflow-x-auto rounded-lg border border-danger/30 bg-danger-dim p-4 text-xs text-danger">
            {executeError}
          </pre>
        )}

        {executeResult != null && (
          <pre className="mt-4 overflow-x-auto rounded-lg border border-border bg-surface p-4 text-xs text-text-secondary">
            {JSON.stringify(executeResult, null, 2)}
          </pre>
        )}
      </div>

      <div className="mt-10 border-t border-border pt-8">
        <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-muted">
          Read-only forensics — no execute, enable, create, or send anywhere
        </div>
        <h2 className="text-lg font-semibold tracking-tight">Analyze a mined transaction</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Fetches the real transaction + receipt, attempts a trace and a revert-reason replay, decodes the outer{" "}
          <code className="font-mono">execute(bytes,bytes[])</code> call, and — if a workflow ID is given — compares
          the decoded calldata byte-for-byte against what&apos;s actually persisted in KeeperHub.
        </p>

        <div className="card mt-4 flex flex-col gap-3 p-5">
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            Transaction hash
            <input
              value={forensicsTxHash}
              onChange={(e) => setForensicsTxHash(e.target.value)}
              className="rounded-lg border border-border-strong bg-transparent px-3 py-2 text-sm text-text-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            Workflow ID (optional, for byte-for-byte comparison)
            <input
              value={forensicsWorkflowId}
              onChange={(e) => setForensicsWorkflowId(e.target.value)}
              className="rounded-lg border border-border-strong bg-transparent px-3 py-2 text-sm text-text-primary"
            />
          </label>
          <button
            onClick={runForensics}
            disabled={forensicsLoading || !forensicsTxHash}
            className="w-fit rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {forensicsLoading ? "Analyzing…" : "Analyze (read-only)"}
          </button>
        </div>

        {forensicsError && (
          <pre className="mt-4 overflow-x-auto rounded-lg border border-danger/30 bg-danger-dim p-4 text-xs text-danger">
            {forensicsError}
          </pre>
        )}

        {forensicsResult != null && (
          <pre className="mt-4 overflow-x-auto rounded-lg border border-border bg-surface p-4 text-xs text-text-secondary">
            {JSON.stringify(forensicsResult, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
