"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@/lib/useWallet";
import { useHydrated } from "@/lib/useHydrated";
import { shortHash } from "@/lib/mock";
import { PageShell, PageHeader } from "@/components/PageShell";
import { StatusPill } from "@/components/StatusPill";

/**
 * Real Ethereum mainnet swap: real Wayfinder quote -> real decode -> real
 * on-chain allowance check -> real KeeperHub workflow -> approval-hash
 * security gate -> real KeeperHub execute(). Every number on this page
 * comes from an actual API/RPC response; nothing here is simulated. This
 * is the productionized version of the flow proven out on /wayfinder-test.
 */

const USDC_DECIMALS = 6;
const WETH_DECIMALS = 18;

// Display-only labels for this router's real Commands enum (verified against
// its published source on Etherscan). Never used for trust decisions — the
// backend's router allowlist is address-based (isVerifiedRouter), not this.
const COMMAND_LABELS: Record<string, string> = {
  "00": "Swap (Uniswap V3)",
  "02": "Pull tokens (Permit2)",
  "03": "Permit2 batch",
  "05": "Transfer",
  "07": "Pull tokens (transferFrom)",
  "08": "Swap (Uniswap V2)",
  "09": "Swap (Uniswap V2, exact out)",
  "0a": "Permit2 signature",
  "0b": "Wrap ETH",
  "0c": "Unwrap WETH",
  "0d": "Permit2 batch transfer",
  "0e": "Balance check",
  "10": "Swap (Uniswap V4)",
  "22": "Swap (Balancer)",
  "23": "Swap (Curve)",
};

function describeCommands(commandsHex: string): string {
  const bytes = commandsHex.replace(/^0x/, "").match(/.{1,2}/g) ?? [];
  return bytes.map((b) => COMMAND_LABELS[b.toLowerCase()] ?? `Unknown (0x${b})`).join(" → ");
}

function formatUnits(raw: string, decimals: number, maxFractionDigits = 6): string {
  const n = Number(raw) / 10 ** decimals;
  return n.toLocaleString(undefined, { maximumFractionDigits: maxFractionDigits });
}

interface WalletState {
  executionWallet: string;
  usdcBalance: string;
  wethBalance: string;
}

interface PrepareResult {
  ok: true;
  keeperhubWorkflowId: string;
  approvalHash: string;
  inputAmountRaw: string;
  tokenAddress: string;
  routerAddress: string;
  approvalNeeded: boolean;
  securityPlan: { commands: string };
}

interface ExecuteResult {
  ok: true;
  workflowId: string;
  executionId: string;
  status: string;
  transactionHashes?: string[];
}

type Stage = "form" | "preparing" | "prepared" | "executing" | "success" | "error";

export default function SwapPage() {
  const hydrated = useHydrated();
  const { address, isConnected } = useWallet();

  const [amount, setAmount] = useState("1.2");
  const [stage, setStage] = useState<Stage>("form");
  const [prepared, setPrepared] = useState<PrepareResult | null>(null);
  const [executed, setExecuted] = useState<ExecuteResult | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  const [walletState, setWalletState] = useState<WalletState | null>(null);
  const [walletStateLoading, setWalletStateLoading] = useState(true);
  const [balancesBefore, setBalancesBefore] = useState<WalletState | null>(null);

  async function loadWalletState() {
    try {
      const res = await fetch("/api/keeperhub/mainnet-wallet-state");
      const data = await res.json();
      if (data.ok) setWalletState(data);
    } catch {
      // Non-fatal — the balance display is informational, not required to swap.
    } finally {
      setWalletStateLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/keeperhub/mainnet-wallet-state")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.ok) setWalletState(data);
        setWalletStateLoading(false);
      })
      .catch(() => {
        if (!cancelled) setWalletStateLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handlePrepare() {
    setStage("preparing");
    setErrorDetail(null);
    setBalancesBefore(walletState);
    try {
      const res = await fetch("/api/keeperhub/prepare-mainnet-swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromToken: "usd-coin-ethereum", toToken: "weth-ethereum", amount }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErrorDetail(data.error ?? "Failed to prepare the swap.");
        setStage("error");
        return;
      }
      setPrepared(data);
      setStage("prepared");
    } catch (err) {
      setErrorDetail(err instanceof Error ? err.message : "Request failed.");
      setStage("error");
    }
  }

  async function handleExecute() {
    if (!prepared) return;
    setStage("executing");
    setErrorDetail(null);
    try {
      const res = await fetch("/api/keeperhub/execute-mainnet-swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowId: prepared.keeperhubWorkflowId, approvedHash: prepared.approvalHash }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErrorDetail(data.error ?? "Execution failed.");
        setStage("error");
        return;
      }
      setExecuted(data);
      setStage("success");
      loadWalletState();
    } catch (err) {
      setErrorDetail(err instanceof Error ? err.message : "Request failed.");
      setStage("error");
    }
  }

  function reset() {
    setStage("form");
    setPrepared(null);
    setExecuted(null);
    setErrorDetail(null);
  }

  if (!hydrated) return null;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Real execution — Ethereum mainnet"
        title="Swap USDC → WETH"
        description="A real Wayfinder quote, decoded and passed through unmodified to a real KeeperHub workflow. Every number below comes from a live API or on-chain read — nothing here is simulated."
        action={<StatusPill tone="wayfinder" dot>Mainnet</StatusPill>}
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="KeeperHub execution wallet" value={walletState ? shortHash(walletState.executionWallet, 6, 4) : "—"} mono loading={walletStateLoading} />
        <StatCard label="USDC balance" value={walletState ? `${formatUnits(walletState.usdcBalance, USDC_DECIMALS)} USDC` : "—"} loading={walletStateLoading} />
        <StatCard label="WETH balance" value={walletState ? `${formatUnits(walletState.wethBalance, WETH_DECIMALS)} WETH` : "—"} loading={walletStateLoading} />
      </div>

      <div className="mb-6 rounded-lg border border-wayfinder/30 bg-wayfinder-dim px-4 py-2.5 text-xs text-text-secondary">
        <span className="font-medium text-wayfinder">Execution runs through KeeperHub&apos;s own non-custodial wallet</span>, not
        your connected wallet — signing and gas are sponsored by KeeperHub. Your browser wallet
        {isConnected ? <> (<span className="font-mono">{shortHash(address ?? "", 4, 4)}</span>)</> : ""} is identity/context only
        and never signs this transaction.
      </div>

      <div className="card p-6">
        {stage === "form" && (
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm text-text-secondary">
              Amount (USDC)
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                className="rounded-lg border border-border-strong bg-transparent px-3 py-2.5 text-sm text-text-primary"
              />
            </label>
            <button
              onClick={handlePrepare}
              disabled={!amount || Number(amount) <= 0}
              className="w-fit rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-transform enabled:hover:scale-[1.02] enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Get real quote
            </button>
          </div>
        )}

        {stage === "preparing" && (
          <div className="flex items-center justify-center gap-3 py-10 text-center text-sm text-text-secondary">
            <span className="h-4 w-4 shrink-0 rounded-full border-2 border-accent border-t-transparent spin-slow" />
            Requesting a real Wayfinder quote and creating the KeeperHub workflow…
          </div>
        )}

        {stage === "prepared" && prepared && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-text-primary">Ready to execute</span>
              <StatusPill tone="success" dot>Real quote received</StatusPill>
            </div>

            <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-sm">
              <Row label="Spending" value={`${formatUnits(prepared.inputAmountRaw, USDC_DECIMALS)} USDC`} />
              <Row label="Router" value={shortHash(prepared.routerAddress, 6, 4)} mono verified />
              <Row label="Route" value={describeCommands(prepared.securityPlan.commands)} />
              <Row label="Approval needed" value={prepared.approvalNeeded ? "Yes — included in this workflow" : "No — existing allowance sufficient"} />
              <Row label="Workflow ID" value={prepared.keeperhubWorkflowId} mono />
              <Row label="Approval hash" value={shortHash(prepared.approvalHash, 8, 6)} mono />
            </div>

            <p className="text-xs text-text-muted">
              This hash is recomputed from what&apos;s actually stored in KeeperHub immediately before execution — if
              anything about this workflow changes between now and then, execution is refused automatically.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={reset}
                className="rounded-lg border border-border-strong px-5 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:border-danger/50 hover:text-danger"
              >
                Cancel
              </button>
              <button
                onClick={handleExecute}
                className="rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Confirm &amp; Execute on mainnet
              </button>
            </div>
          </div>
        )}

        {stage === "executing" && (
          <div className="flex items-center justify-center gap-3 py-10 text-center text-sm text-text-secondary">
            <span className="h-4 w-4 shrink-0 rounded-full border-2 border-accent border-t-transparent spin-slow" />
            Executing on Ethereum mainnet — this sends a real transaction…
          </div>
        )}

        {stage === "success" && executed && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-text-primary">Swap confirmed</span>
              <StatusPill tone="success" dot>{executed.status}</StatusPill>
            </div>

            {executed.transactionHashes?.[0] && (
              <a
                href={`https://etherscan.io/tx/${executed.transactionHashes[0]}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-lg border border-success/30 bg-success-dim px-4 py-3 text-sm font-medium text-success hover:border-success/50"
              >
                <span className="font-mono text-xs">{shortHash(executed.transactionHashes[0], 10, 8)}</span>
                <span>View on Etherscan →</span>
              </a>
            )}

            {balancesBefore && walletState && (
              <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-sm">
                <Row
                  label="USDC balance"
                  value={`${formatUnits(balancesBefore.usdcBalance, USDC_DECIMALS)} → ${formatUnits(walletState.usdcBalance, USDC_DECIMALS)}`}
                />
                <Row
                  label="WETH balance"
                  value={`${formatUnits(balancesBefore.wethBalance, WETH_DECIMALS)} → ${formatUnits(walletState.wethBalance, WETH_DECIMALS)}`}
                />
              </div>
            )}

            <button
              onClick={reset}
              className="w-fit rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Swap again
            </button>
          </div>
        )}

        {stage === "error" && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="max-w-md text-sm text-danger">{errorDetail}</p>
            <button
              onClick={reset}
              className="rounded-lg border border-border-strong px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:border-accent/50"
            >
              Start over
            </button>
          </div>
        )}
      </div>
    </PageShell>
  );
}

function StatCard({ label, value, mono, loading }: { label: string; value: string; mono?: boolean; loading?: boolean }) {
  return (
    <div className="card px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{label}</div>
      <div className={`mt-1 text-sm font-medium text-text-primary ${mono ? "font-mono" : ""}`}>
        {loading ? <span className="inline-block h-4 w-20 animate-pulse rounded bg-surface-hover" /> : value}
      </div>
    </div>
  );
}

function Row({ label, value, mono, verified }: { label: string; value: string; mono?: boolean; verified?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-1.5 last:border-b-0">
      <span className="shrink-0 text-text-muted">{label}</span>
      <span className={`text-right text-text-primary ${mono ? "font-mono text-xs" : ""}`}>
        {value} {verified && <span className="text-success">✓</span>}
      </span>
    </div>
  );
}
