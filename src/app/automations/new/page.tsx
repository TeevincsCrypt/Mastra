"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useHydrated } from "@/lib/useHydrated";
import { useWallet } from "@/lib/useWallet";
import { useAuth } from "@/lib/useAuth";
import { PageShell, PageHeader } from "@/components/PageShell";
import { StatusPill } from "@/components/StatusPill";
import { SUPPORTED_TOKENS } from "@/lib/tokens";
import type { AutomationType } from "@/lib/store/types";

interface Template {
  type: AutomationType;
  name: string;
  description: string;
  fromToken: string;
  toToken: string;
  amount: string;
  frequency: "one-time" | "weekly" | "daily" | "manual";
  triggerDescription: string;
  triggerLive: boolean;
}

const TEMPLATES: Template[] = [
  {
    type: "eth-dca",
    name: "ETH Auto-DCA",
    description: "Buy a fixed amount of WETH with USDC on a schedule.",
    fromToken: "USDC",
    toToken: "WETH",
    amount: "1.2",
    frequency: "weekly",
    triggerDescription: "Manually triggered — KeeperHub has no scheduled/cron trigger wired into this project yet (see limitation below).",
    triggerLive: false,
  },
  {
    type: "gas-guardian",
    name: "Gas Guardian",
    description: "Top up WETH from USDC when you decide balance is running low.",
    fromToken: "USDC",
    toToken: "WETH",
    amount: "1.0",
    frequency: "manual",
    triggerDescription: "Configured strategy only — no live balance-threshold trigger exists yet. Executed manually from this page.",
    triggerLive: false,
  },
  {
    type: "take-profit",
    name: "Take Profit Guardian",
    description: "Sell WETH back to USDC when you decide a target has been hit.",
    fromToken: "WETH",
    toToken: "USDC",
    amount: "0.001",
    frequency: "manual",
    triggerDescription: "Configured strategy only — no live price-feed trigger exists yet. Executed manually from this page.",
    triggerLive: false,
  },
  {
    type: "treasury-rebalancer",
    name: "Treasury Rebalancer",
    description: "Move funds between DAI and WETH toward a target allocation.",
    fromToken: "DAI",
    toToken: "WETH",
    amount: "1.0",
    frequency: "manual",
    triggerDescription: "Configured strategy only — no live deviation-threshold trigger exists yet. Executed manually from this page.",
    triggerLive: false,
  },
  {
    type: "custom",
    name: "Custom Automation",
    description: "Define the pair, amount and limits yourself.",
    fromToken: "USDC",
    toToken: "WETH",
    amount: "1.2",
    frequency: "manual",
    triggerDescription: "Manually triggered from this page.",
    triggerLive: true,
  },
];

type Step = "strategy" | "configure" | "policy" | "review" | "approve" | "activate";

export default function CreateAutomationPage() {
  const hydrated = useHydrated();
  const router = useRouter();
  const { isConnected, connectWallet } = useWallet();
  const { authenticated, authenticatedAddress, signingIn, error: authError, signIn } = useAuth();

  const [step, setStep] = useState<Step>("strategy");
  const [template, setTemplate] = useState<Template | null>(null);

  const [name, setName] = useState("");
  const [fromToken, setFromToken] = useState("USDC");
  const [toToken, setToToken] = useState("WETH");
  const [amount, setAmount] = useState("1.2");
  const [frequency, setFrequency] = useState<Template["frequency"]>("manual");

  const [maxExecution, setMaxExecution] = useState("1.2");
  const [dailyLimit, setDailyLimit] = useState("1.2");
  const [monthlyLimit, setMonthlyLimit] = useState("10");
  const [maxSlippageBps, setMaxSlippageBps] = useState("100");

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  if (!hydrated) return null;

  function chooseTemplate(t: Template) {
    setTemplate(t);
    setName(t.name);
    setFromToken(t.fromToken);
    setToToken(t.toToken);
    setAmount(t.amount);
    setFrequency(t.frequency);
    setMaxExecution(t.amount);
    setDailyLimit(t.amount);
    setMonthlyLimit(String(Number(t.amount) * 20));
    setStep("configure");
  }

  async function handleApproveAndCreate() {
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: template?.description ?? "",
          type: template?.type ?? "custom",
          fromToken,
          toToken,
          amount,
          frequency,
          triggerDescription: template?.triggerDescription,
          triggerLive: template?.triggerLive ?? false,
          policy: { maxExecutionAmount: maxExecution, dailyLimitAmount: dailyLimit, monthlyLimitAmount: monthlyLimit, maxSlippageBps: Number(maxSlippageBps) },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setCreateError(data.error ?? "Failed to create automation.");
        return;
      }
      setCreatedId(data.automation.id);
      setStep("activate");
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setCreating(false);
    }
  }

  async function handleActivate() {
    if (!createdId) return;
    await fetch(`/api/automations/${createdId}/activate`, { method: "POST" });
    router.push(`/automations/${createdId}`);
  }

  return (
    <PageShell>
      <PageHeader eyebrow="New automation" title="Create Automation" description="Every step below is real — nothing is submitted until you explicitly approve it." />

      <StepIndicator step={step} />

      <div className="card mt-6 p-6">
        {step === "strategy" && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.type}
                onClick={() => chooseTemplate(t)}
                className="rounded-lg border border-border-strong p-4 text-left transition-colors hover:border-accent/50 hover:bg-surface-hover"
              >
                <div className="text-sm font-semibold text-text-primary">{t.name}</div>
                <div className="mt-1 text-xs text-text-secondary">{t.description}</div>
                {!t.triggerLive && <div className="mt-2 text-[10px] font-medium uppercase tracking-wide text-warning">Configured strategy — manual trigger</div>}
              </button>
            ))}
          </div>
        )}

        {step === "configure" && (
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm text-text-secondary">
              Automation name
              <input value={name} onChange={(e) => setName(e.target.value)} className="rounded-lg border border-border-strong bg-transparent px-3 py-2.5 text-sm text-text-primary" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5 text-sm text-text-secondary">
                From
                <select value={fromToken} onChange={(e) => setFromToken(e.target.value)} className="rounded-lg border border-border-strong bg-transparent px-3 py-2.5 text-sm text-text-primary">
                  {SUPPORTED_TOKENS.map((tok) => (
                    <option key={tok.symbol} value={tok.symbol}>{tok.symbol}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm text-text-secondary">
                To
                <select value={toToken} onChange={(e) => setToToken(e.target.value)} className="rounded-lg border border-border-strong bg-transparent px-3 py-2.5 text-sm text-text-primary">
                  {SUPPORTED_TOKENS.map((tok) => (
                    <option key={tok.symbol} value={tok.symbol}>{tok.symbol}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="flex flex-col gap-1.5 text-sm text-text-secondary">
              Amount ({fromToken})
              <input value={amount} onChange={(e) => setAmount(e.target.value)} className="rounded-lg border border-border-strong bg-transparent px-3 py-2.5 text-sm text-text-primary" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-text-secondary">
              Frequency
              <select value={frequency} onChange={(e) => setFrequency(e.target.value as Template["frequency"])} className="rounded-lg border border-border-strong bg-transparent px-3 py-2.5 text-sm text-text-primary">
                <option value="manual">Manual (trigger from the Execution Center)</option>
                <option value="daily">Daily (configured — no live scheduler yet)</option>
                <option value="weekly">Weekly (configured — no live scheduler yet)</option>
                <option value="one-time">One-time</option>
              </select>
            </label>
            <NavButtons onBack={() => setStep("strategy")} onNext={() => setStep("policy")} nextDisabled={!name || !amount} />
          </div>
        )}

        {step === "policy" && (
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm text-text-secondary">
              Maximum per execution ({fromToken})
              <input value={maxExecution} onChange={(e) => setMaxExecution(e.target.value)} className="rounded-lg border border-border-strong bg-transparent px-3 py-2.5 text-sm text-text-primary" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-text-secondary">
              Daily limit ({fromToken})
              <input value={dailyLimit} onChange={(e) => setDailyLimit(e.target.value)} className="rounded-lg border border-border-strong bg-transparent px-3 py-2.5 text-sm text-text-primary" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-text-secondary">
              Monthly limit ({fromToken})
              <input value={monthlyLimit} onChange={(e) => setMonthlyLimit(e.target.value)} className="rounded-lg border border-border-strong bg-transparent px-3 py-2.5 text-sm text-text-primary" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-text-secondary">
              Max slippage (bps)
              <input value={maxSlippageBps} onChange={(e) => setMaxSlippageBps(e.target.value)} className="rounded-lg border border-border-strong bg-transparent px-3 py-2.5 text-sm text-text-primary" />
            </label>
            <p className="text-xs text-text-muted">Chain: Ethereum mainnet only. Router: the one independently verified router this project trusts.</p>
            <NavButtons onBack={() => setStep("configure")} onNext={() => setStep("review")} />
          </div>
        )}

        {step === "review" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-sm">
              <Row label="Strategy" value={name} />
              <Row label="Trade" value={`${amount} ${fromToken} → ${toToken}`} />
              <Row label="Trigger" value={template?.triggerDescription ?? "Manual"} />
              <Row label="Max / execution" value={`${maxExecution} ${fromToken}`} />
              <Row label="Daily limit" value={`${dailyLimit} ${fromToken}`} />
              <Row label="Monthly limit" value={`${monthlyLimit} ${fromToken}`} />
              <Row label="Max slippage" value={`${maxSlippageBps}bps`} />
              <Row label="Execution mechanism" value="Wayfinder route + Mastra policy + KeeperHub execution" />
            </div>
            <NavButtons onBack={() => setStep("policy")} onNext={() => setStep("approve")} />
          </div>
        )}

        {step === "approve" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-text-secondary">
              Creating an automation requires a real signature from your wallet — a sign-in message, not a transaction. It costs no gas and proves you, specifically, own this
              automation.
            </p>
            {!isConnected ? (
              <button onClick={connectWallet} className="w-fit rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white">Connect Wallet</button>
            ) : !authenticated ? (
              <button onClick={signIn} disabled={signingIn} className="w-fit rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                {signingIn ? "Waiting for signature…" : "Sign to authorize"}
              </button>
            ) : (
              <div className="flex items-center gap-2 text-sm text-success">
                <StatusPill tone="success" dot>Signed in as {authenticatedAddress}</StatusPill>
              </div>
            )}
            {authError && <p className="text-xs text-danger">{authError}</p>}
            {createError && <p className="text-xs text-danger">{createError}</p>}
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={() => setStep("review")} className="rounded-lg border border-border-strong px-5 py-2.5 text-sm font-medium text-text-secondary">Back</button>
              <button
                onClick={handleApproveAndCreate}
                disabled={!authenticated || creating}
                className="rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {creating ? "Creating…" : "Approve & Create"}
              </button>
            </div>
          </div>
        )}

        {step === "activate" && createdId && (
          <div className="flex flex-col gap-4">
            <StatusPill tone="success" dot>Automation created</StatusPill>
            <p className="text-sm text-text-secondary">
              This does not pre-create a KeeperHub workflow — Wayfinder quotes are time-sensitive and can&apos;t be reused, so a real KeeperHub workflow is created fresh at the
              moment you actually trigger an execution. Activate this automation, then trigger it from its page to see that happen for real.
            </p>
            <button onClick={handleActivate} className="w-fit rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white">Activate</button>
          </div>
        )}
      </div>
    </PageShell>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const steps: Step[] = ["strategy", "configure", "policy", "review", "approve", "activate"];
  const labels: Record<Step, string> = { strategy: "Strategy", configure: "Configure", policy: "Policy", review: "Review", approve: "Approve", activate: "Activate" };
  const idx = steps.indexOf(step);
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {steps.map((s, i) => (
        <span key={s} className={`rounded-full px-3 py-1 font-medium ${i === idx ? "bg-accent text-white" : i < idx ? "bg-success-dim text-success" : "bg-surface-hover text-text-muted"}`}>
          {i + 1}. {labels[s]}
        </span>
      ))}
    </div>
  );
}

function NavButtons({ onBack, onNext, nextDisabled }: { onBack: () => void; onNext: () => void; nextDisabled?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button onClick={onBack} className="rounded-lg border border-border-strong px-5 py-2.5 text-sm font-medium text-text-secondary">Back</button>
      <button onClick={onNext} disabled={nextDisabled} className="rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">
        Continue
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-1.5 last:border-b-0">
      <span className="shrink-0 text-text-muted">{label}</span>
      <span className="text-right text-text-primary">{value}</span>
    </div>
  );
}
