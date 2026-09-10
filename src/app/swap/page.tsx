"use client";

import { useEffect, useState } from "react";
import { writeContract, waitForTransactionReceipt } from "wagmi/actions";
import type { Hex } from "viem";
import { wagmiConfig } from "@/lib/wagmi";
import { useWallet } from "@/lib/useWallet";
import { useHydrated } from "@/lib/useHydrated";
import { shortHash, formatUnits } from "@/lib/format";
import { PageShell, PageHeader } from "@/components/PageShell";
import { StatusPill } from "@/components/StatusPill";
import { SUPPORTED_TOKENS, findToken } from "@/lib/tokens";
import { ERC20_ABI } from "@/lib/onchain/erc20Abi";
import { EXECUTE_ABI } from "@/lib/wayfinder/executeCalldata";
import { loadHistory, saveHistory, type HistoryEntry } from "@/lib/swapHistory";

/**
 * Real, self-custodial Ethereum mainnet swap: real Wayfinder quote,
 * decoded and verified server-side, then signed and broadcast directly by
 * the visitor's OWN connected wallet — approve (if needed) then execute.
 * No intermediary wallet ever holds or spends the visitor's funds; each
 * visitor funds and spends only their own wallet. Nothing here is
 * simulated — every balance, quote, and transaction is real.
 */

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

interface WalletBalances {
  address: string;
  balances: Record<string, string>;
}

interface PrepareResult {
  ok: true;
  tokenAddress: string;
  routerAddress: string;
  network: string;
  inputAmountRaw: string;
  requiredAllowance: string;
  currentAllowance: string;
  approvalNeeded: boolean;
  commands: Hex;
  inputs: Hex[];
}

type Stage = "form" | "preparing" | "prepared" | "executing" | "success" | "error";

const HISTORY_LIMIT_DISPLAY = 5;

export default function SwapPage() {
  const hydrated = useHydrated();
  const { address, isConnected, isConnecting, isWrongNetwork, isSwitching, hasInjectedProvider, connectWallet, switchToMainnet, connectError } =
    useWallet();

  const [fromSymbol, setFromSymbol] = useState("USDC");
  const [toSymbol, setToSymbol] = useState("WETH");
  const fromToken = findToken(fromSymbol) ?? SUPPORTED_TOKENS[0];
  const toToken = findToken(toSymbol) ?? SUPPORTED_TOKENS[1];

  const [amount, setAmount] = useState("1.2");
  const [stage, setStage] = useState<Stage>("form");
  const [prepared, setPrepared] = useState<PrepareResult | null>(null);
  const [executingStep, setExecutingStep] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  const [walletBalances, setWalletBalances] = useState<WalletBalances | null>(null);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [balancesBefore, setBalancesBefore] = useState<WalletBalances | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(() => (typeof window === "undefined" ? [] : loadHistory()));

  function recordHistory(entry: HistoryEntry) {
    setHistory((prev) => {
      const next = [entry, ...prev];
      saveHistory(next);
      return next;
    });
  }

  async function loadBalances(addr: string) {
    try {
      const res = await fetch(`/api/onchain/balances?address=${addr}`);
      const data = await res.json();
      if (data.ok) setWalletBalances(data);
    } catch {
      // Non-fatal — balance display is informational.
    }
  }

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    fetch(`/api/onchain/balances?address=${address}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.ok) setWalletBalances(data);
        setBalancesLoading(false);
      })
      .catch(() => {
        if (!cancelled) setBalancesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [address]);

  function toggleDirection() {
    setFromSymbol(toSymbol);
    setToSymbol(fromSymbol);
    resetFlow();
  }

  function handleFromChange(symbol: string) {
    setFromSymbol(symbol);
    if (symbol === toSymbol) {
      const alt = SUPPORTED_TOKENS.find((t) => t.symbol !== symbol);
      if (alt) setToSymbol(alt.symbol);
    }
  }

  function handleToChange(symbol: string) {
    setToSymbol(symbol);
    if (symbol === fromSymbol) {
      const alt = SUPPORTED_TOKENS.find((t) => t.symbol !== symbol);
      if (alt) setFromSymbol(alt.symbol);
    }
  }

  async function handlePrepare() {
    if (!address) return;
    setStage("preparing");
    setErrorDetail(null);
    setBalancesBefore(walletBalances);
    try {
      const res = await fetch("/api/wayfinder/prepare-swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromToken: fromToken.wayfinderId, toToken: toToken.wayfinderId, amount, walletAddress: address }),
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
    if (!prepared || !address) return;
    setStage("executing");
    setErrorDetail(null);
    setTxHash(null);
    setTxStatus(null);

    const amountLabel = `${formatUnits(prepared.inputAmountRaw, fromToken.decimals)} ${fromToken.symbol}`;
    const historyBase = { fromSymbol: fromToken.symbol, toSymbol: toToken.symbol };

    try {
      if (prepared.approvalNeeded) {
        setExecutingStep("Confirm the approval in your wallet…");
        const approveHash = await writeContract(wagmiConfig, {
          address: prepared.tokenAddress as Hex,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [prepared.routerAddress as Hex, BigInt(prepared.requiredAllowance)],
        });
        setExecutingStep("Confirming your approval on-chain…");
        await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });
      }

      setExecutingStep("Confirm the swap in your wallet…");
      const swapHash = await writeContract(wagmiConfig, {
        address: prepared.routerAddress as Hex,
        abi: EXECUTE_ABI,
        functionName: "execute",
        args: [prepared.commands, prepared.inputs],
      });
      setTxHash(swapHash);
      setExecutingStep("Confirming your swap on-chain…");
      const receipt = await waitForTransactionReceipt(wagmiConfig, { hash: swapHash });
      setTxStatus(receipt.status);

      if (receipt.status === "success") {
        setStage("success");
        recordHistory({ timestamp: Date.now(), amountLabel, status: "success", txHash: swapHash, ...historyBase });
      } else {
        setErrorDetail("The swap did not succeed on-chain. Gas was spent, but the swap itself reverted — no funds beyond gas were lost.");
        setStage("error");
        recordHistory({ timestamp: Date.now(), amountLabel, status: "reverted", txHash: swapHash, ...historyBase });
      }
      loadBalances(address);
    } catch (err) {
      const rejected =
        err instanceof Error && (err.message.toLowerCase().includes("user rejected") || err.message.toLowerCase().includes("user denied"));
      const message = rejected ? "You declined the signature request in your wallet." : err instanceof Error ? err.message : "Request failed.";
      setErrorDetail(message);
      setStage("error");
      if (!rejected) {
        recordHistory({ timestamp: Date.now(), amountLabel, status: "failed", error: message, ...historyBase });
      }
    }
  }

  function resetFlow() {
    setStage("form");
    setPrepared(null);
    setTxHash(null);
    setTxStatus(null);
    setErrorDetail(null);
  }

  if (!hydrated) return null;

  const recentHistory = history.slice(0, HISTORY_LIMIT_DISPLAY);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Real execution — your wallet, your funds"
        title={`Swap ${fromToken.symbol} → ${toToken.symbol}`}
        description="A real Wayfinder quote, decoded and verified, then signed directly by your own wallet. Mastra never holds or spends your funds — you approve and execute every step yourself."
        action={<StatusPill tone="wayfinder" dot>Mainnet</StatusPill>}
      />

      {!isConnected ? (
        <div className="card flex flex-col items-center gap-4 px-8 py-16 text-center">
          <p className="max-w-sm text-sm text-text-secondary">
            Connect your own wallet to swap. This is self-custodial — your wallet signs and pays for your own swap
            directly on-chain. Mastra never holds your funds.
          </p>
          {!hasInjectedProvider ? (
            <a
              href="https://metamask.io/download/"
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-border-strong px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:border-accent/50"
            >
              No wallet detected — install MetaMask
            </a>
          ) : (
            <button
              onClick={connectWallet}
              disabled={isConnecting}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isConnecting ? "Connecting…" : "Connect Wallet"}
            </button>
          )}
          {connectError && <p className="max-w-sm text-xs text-danger">{connectError.message}</p>}
        </div>
      ) : isWrongNetwork ? (
        <div className="card flex flex-col items-center gap-4 px-8 py-16 text-center">
          <p className="max-w-sm text-sm text-text-secondary">
            Your wallet is connected to the wrong network. Real swaps here happen on Ethereum mainnet — switch to
            continue.
          </p>
          <button
            onClick={switchToMainnet}
            disabled={isSwitching}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
          >
            {isSwitching ? "Switching…" : "Switch to Ethereum Mainnet"}
          </button>
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-4">
            <StatCard label="Your wallet" value={shortHash(address ?? "", 6, 4)} mono />
            {SUPPORTED_TOKENS.map((token) => (
              <StatCard
                key={token.symbol}
                label={`${token.symbol} balance`}
                value={walletBalances ? `${formatUnits(walletBalances.balances[token.symbol] ?? "0", token.decimals)} ${token.symbol}` : "—"}
                loading={balancesLoading}
              />
            ))}
          </div>

          <div className="mb-6 rounded-lg border border-wayfinder/30 bg-wayfinder-dim px-4 py-2.5 text-xs text-text-secondary">
            <span className="font-medium text-wayfinder">Self-custodial:</span> Mastra never holds your funds and
            never signs on your behalf. Your wallet (<span className="font-mono">{shortHash(address ?? "", 4, 4)}</span>)
            signs the approval and the swap directly — you can review the exact route below before either signature.
          </div>

          <div className="card p-6">
            {stage === "form" && (
              <div className="flex flex-col gap-4">
                <div className="flex items-end gap-3">
                  <label className="flex flex-1 flex-col gap-1.5 text-sm text-text-secondary">
                    From
                    <select
                      value={fromSymbol}
                      onChange={(e) => handleFromChange(e.target.value)}
                      className="rounded-lg border border-border-strong bg-transparent px-3 py-2.5 text-sm text-text-primary"
                    >
                      {SUPPORTED_TOKENS.map((t) => (
                        <option key={t.symbol} value={t.symbol}>
                          {t.symbol} — {t.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <button
                    type="button"
                    onClick={toggleDirection}
                    title="Reverse direction"
                    className="mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border-strong text-text-secondary transition-colors hover:border-accent/50 hover:text-accent"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path
                        d="M3 5.5h8m0 0-2.5-2.5M11 5.5 8.5 8M11 8.5H3m0 0 2.5 2.5M3 8.5 5.5 6"
                        stroke="currentColor"
                        strokeWidth="1.3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>

                  <label className="flex flex-1 flex-col gap-1.5 text-sm text-text-secondary">
                    To
                    <select
                      value={toSymbol}
                      onChange={(e) => handleToChange(e.target.value)}
                      className="rounded-lg border border-border-strong bg-transparent px-3 py-2.5 text-sm text-text-primary"
                    >
                      {SUPPORTED_TOKENS.map((t) => (
                        <option key={t.symbol} value={t.symbol}>
                          {t.symbol} — {t.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="flex flex-col gap-1.5 text-sm text-text-secondary">
                  Amount ({fromToken.symbol})
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
                Requesting a real Wayfinder quote…
              </div>
            )}

            {stage === "prepared" && prepared && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-text-primary">Ready to sign</span>
                  <StatusPill tone="success" dot>Real quote received</StatusPill>
                </div>

                <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-sm">
                  <Row label="Spending" value={`${formatUnits(prepared.inputAmountRaw, fromToken.decimals)} ${fromToken.symbol}`} />
                  <Row label="Router" value={shortHash(prepared.routerAddress, 6, 4)} mono verified />
                  <Row label="Route" value={describeCommands(prepared.commands)} />
                  <Row
                    label="Approval needed"
                    value={prepared.approvalNeeded ? "Yes — you'll sign this first" : "No — existing allowance is sufficient"}
                  />
                </div>

                <p className="text-xs text-text-muted">
                  {prepared.approvalNeeded
                    ? "You'll be asked to sign two transactions: an approval, then the swap itself. Both happen in your own wallet."
                    : "You'll be asked to sign one transaction: the swap itself, in your own wallet."}
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={resetFlow}
                    className="rounded-lg border border-border-strong px-5 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:border-danger/50 hover:text-danger"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleExecute}
                    className="rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Confirm &amp; sign in wallet
                  </button>
                </div>
              </div>
            )}

            {stage === "executing" && (
              <div className="flex flex-col items-center justify-center gap-3 py-10 text-center text-sm text-text-secondary">
                <span className="h-4 w-4 shrink-0 rounded-full border-2 border-accent border-t-transparent spin-slow" />
                {executingStep}
              </div>
            )}

            {stage === "success" && txHash && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-text-primary">Swap confirmed</span>
                  <StatusPill tone="success" dot>{txStatus}</StatusPill>
                </div>

                <a
                  href={`https://etherscan.io/tx/${txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-lg border border-success/30 bg-success-dim px-4 py-3 text-sm font-medium text-success hover:border-success/50"
                >
                  <span className="font-mono text-xs">{shortHash(txHash, 10, 8)}</span>
                  <span>View on Etherscan →</span>
                </a>

                {balancesBefore && walletBalances && (
                  <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-sm">
                    {SUPPORTED_TOKENS.map((token) => (
                      <Row
                        key={token.symbol}
                        label={`${token.symbol} balance`}
                        value={`${formatUnits(balancesBefore.balances[token.symbol] ?? "0", token.decimals)} → ${formatUnits(walletBalances.balances[token.symbol] ?? "0", token.decimals)}`}
                      />
                    ))}
                  </div>
                )}

                <button
                  onClick={resetFlow}
                  className="w-fit rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  Swap again
                </button>
              </div>
            )}

            {stage === "error" && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-text-primary">{txHash ? "Swap reverted on-chain" : "Could not execute"}</span>
                  {txStatus && <StatusPill tone="danger" dot>{txStatus}</StatusPill>}
                </div>

                <p className="text-sm text-danger">{errorDetail}</p>

                {txHash && (
                  <a
                    href={`https://etherscan.io/tx/${txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-lg border border-danger/30 bg-danger-dim px-4 py-3 text-sm font-medium text-danger hover:border-danger/50"
                  >
                    <span className="font-mono text-xs">{shortHash(txHash, 10, 8)}</span>
                    <span>View on Etherscan →</span>
                  </a>
                )}

                {prepared && (
                  <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-sm">
                    <Row label="Route attempted" value={describeCommands(prepared.commands)} />
                  </div>
                )}

                <button
                  onClick={resetFlow}
                  className="w-fit rounded-lg border border-border-strong px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:border-accent/50"
                >
                  Start over
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {recentHistory.length > 0 && (
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-text-muted">Recent swaps (this browser)</h2>
            <a href="/audit" className="text-xs font-medium text-accent-strong hover:underline">
              View full audit trail →
            </a>
          </div>
          <div className="card overflow-hidden">
            {recentHistory.map((entry, i) => (
              <HistoryRow key={`${entry.timestamp}-${i}`} entry={entry} last={i === recentHistory.length - 1} />
            ))}
          </div>
        </div>
      )}
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

export function HistoryRow({ entry, last }: { entry: HistoryEntry; last?: boolean }) {
  const tone = entry.status === "success" ? "success" : entry.status === "reverted" ? "danger" : "warning";
  const label = entry.status === "success" ? "Success" : entry.status === "reverted" ? "Reverted" : "Failed";
  const when = new Date(entry.timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm ${last ? "" : "border-b border-border"}`}>
      <div className="flex items-center gap-3">
        <StatusPill tone={tone} dot>{label}</StatusPill>
        <span className="text-text-secondary">
          {entry.amountLabel} ({entry.fromSymbol} → {entry.toSymbol})
        </span>
        <span className="text-xs text-text-muted">{when}</span>
      </div>
      {entry.txHash ? (
        <a
          href={`https://etherscan.io/tx/${entry.txHash}`}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-xs text-accent-strong hover:underline"
        >
          {shortHash(entry.txHash, 6, 4)}
        </a>
      ) : (
        <span className="max-w-xs truncate text-xs text-text-muted" title={entry.error}>
          {entry.error ?? "—"}
        </span>
      )}
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
