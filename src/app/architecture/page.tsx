import Link from "next/link";
import { PageShell, PageHeader } from "@/components/PageShell";

const LAYERS = [
  {
    n: "01",
    name: "User",
    tone: "text-text-primary",
    role: "Identity, not custody.",
    detail:
      "The connected browser wallet signs a challenge message to prove identity (sign-in-with-wallet) and, separately, decides what to authorize — an automation's policy limits. It never signs the on-chain swap transaction itself.",
  },
  {
    n: "02",
    name: "Wayfinder",
    tone: "text-wayfinder",
    role: "Finds the route. Never moves funds.",
    detail:
      "Called through the real Wayfinder MCP integration (onchain_quote_swap, onchain_resolve_token). Returns a real quote and real calldata for the best available route. Read-only — quote-only, by design and by what this build's credentials actually permit.",
  },
  {
    n: "03",
    name: "Mastra",
    tone: "text-accent-strong",
    role: "The control plane. Decides, never executes.",
    detail:
      "Automations, the deterministic policy engine, spending budgets, the audit trail, sessions, and the emergency pause all live here. Mastra's own code never holds a private key and never calls the blockchain directly — it only ever asks KeeperHub to act, and only after policy approves.",
  },
  {
    n: "04",
    name: "KeeperHub",
    tone: "text-text-primary",
    role: "The only thing that signs.",
    detail:
      "A real KeeperHub-managed wallet, funded and operated outside this app, is the sole signer for every real transaction. Mastra creates and triggers KeeperHub workflows through its real API — preflight, execute — but the private key never leaves KeeperHub.",
  },
  {
    n: "05",
    name: "Blockchain",
    tone: "text-text-primary",
    role: "Ethereum mainnet. Ground truth.",
    detail:
      "The verified Universal Router at 0xEbE0FA42523F69Ea1E97F5B08282654c19c2c0Ee, decoded from real transaction logs during this project's own forensic work — not assumed from stock Uniswap docs. Every execution record's txHash, gas, and status reflect what actually happened here, nothing simulated.",
  },
];

/**
 * Static reference page — the five-layer responsibility split, stated
 * plainly and matched to what the running code actually does. No live
 * data fetched here; the Integrations and Security pages are where those
 * same claims are backed by real, callable endpoints.
 */
export default function ArchitecturePage() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="How Mastra is built"
        title="Architecture"
        description="Five layers, one rule: the layer that decides is never the layer that signs. AI proposes. Policies decide. KeeperHub executes."
      />

      <div className="flex flex-col gap-3">
        {LAYERS.map((layer, i) => (
          <div key={layer.n} className="card relative overflow-hidden p-6">
            <div className="flex items-start gap-5">
              <div className="text-3xl font-bold text-text-muted/40">{layer.n}</div>
              <div className="flex-1">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className={`text-lg font-semibold ${layer.tone}`}>{layer.name}</span>
                  <span className="text-xs font-medium uppercase tracking-wide text-text-muted">{layer.role}</span>
                </div>
                <p className="mt-2 max-w-2xl text-sm text-text-secondary">{layer.detail}</p>
              </div>
            </div>
            {i < LAYERS.length - 1 && (
              <div className="mt-5 flex justify-center text-text-muted/40">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 2v10M7 12L2.5 7.5M7 12l4.5-4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card p-6">
          <div className="mb-2 text-sm font-semibold text-text-primary">Why the split matters</div>
          <p className="text-xs text-text-secondary">
            An AI agent that can call an execute() function directly, with no boundary in between, is a live financial liability. Mastra&apos;s
            policy engine is a deterministic function — not a model — sitting between any proposal and any real spend. A blocked execution is
            not a failure state: it&apos;s the boundary working.
          </p>
        </div>
        <div className="card p-6">
          <div className="mb-2 text-sm font-semibold text-text-primary">See it live</div>
          <p className="text-xs text-text-secondary">
            <Link href="/policies" className="text-accent-strong hover:underline">Policies</Link> lets you test any amount against a real
            policy. <Link href="/security" className="text-accent-strong hover:underline">Security</Link> shows the real authorization checks.{" "}
            <Link href="/integrations" className="text-accent-strong hover:underline">Integrations</Link> shows the live KeeperHub wallet and a
            real Wayfinder quote.
          </p>
        </div>
      </div>
    </PageShell>
  );
}
