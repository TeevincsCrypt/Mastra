"use client";

import Link from "next/link";

const LAYERS = [
  { name: "User", detail: "Identity only" },
  { name: "Wayfinder", detail: "Finds the route" },
  { name: "Mastra", detail: "Decides, never signs" },
  { name: "KeeperHub", detail: "The only signer" },
  { name: "Blockchain", detail: "Ethereum mainnet" },
];

const PRINCIPLES = [
  {
    title: "Deterministic policy engine",
    body: "Not an LLM's opinion — a pure function evaluating every execution against real limits before KeeperHub is ever called. Test any amount against a real policy on the Policies page.",
    href: "/policies",
    cta: "Test a policy",
  },
  {
    title: "Real spending budgets",
    body: "Daily and monthly limits derived from actual, persisted execution records — never a separately-tracked, driftable counter.",
    href: "/overview",
    cta: "View Mission Control",
  },
  {
    title: "A blocked execution is not a failure",
    body: "When an amount exceeds policy, KeeperHub is never called. The agent does not control the money — Mastra controls the agent.",
    href: "/security",
    cta: "See the authorization model",
  },
];

export function LandingPage({ onConnect }: { onConnect: () => void }) {
  return (
    <div>
      <Hero onConnect={onConnect} />
      <ArchitectureStrip />
      <PrinciplesSection />
      <DisclosureBanner />
      <Footer />
    </div>
  );
}

function Hero({ onConnect }: { onConnect: () => void }) {
  return (
    <section className="border-b border-border px-4 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface px-4 py-1.5 text-xs font-medium text-text-secondary">
          <span className="h-1.5 w-1.5 rounded-full bg-accent pulse-dot" />
          Wayfinder × KeeperHub — real integration, live on Ethereum mainnet
        </span>

        <h1 className="mt-8 text-5xl font-bold tracking-tight text-text-primary sm:text-6xl">MASTRA</h1>
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.25em] text-text-muted">Autonomous on-chain finance</p>

        <p className="mx-auto mt-6 max-w-lg text-lg text-text-secondary">
          &ldquo;Give your agent a budget. Not your private key.&rdquo;
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link href="/overview" className="rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]">
            Launch Mission Control
          </Link>
          <button
            onClick={onConnect}
            className="rounded-lg border border-border-strong px-6 py-3 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-hover"
          >
            Go to Swap
          </button>
        </div>
      </div>
    </section>
  );
}

function ArchitectureStrip() {
  return (
    <section className="border-b border-border px-4 py-16 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-text-muted">
          Five layers. One rule — the layer that decides is never the layer that signs.
        </p>
        <div className="mt-8 flex flex-col items-center gap-2 sm:flex-row sm:justify-between sm:gap-0">
          {LAYERS.map((layer, i) => (
            <div key={layer.name} className="flex items-center gap-2">
              <div className="card px-5 py-4 text-center">
                <div className="text-sm font-semibold text-text-primary">{layer.name}</div>
                <div className="mt-0.5 text-[11px] text-text-muted">{layer.detail}</div>
              </div>
              {i < LAYERS.length - 1 && (
                <svg className="hidden shrink-0 text-text-muted/40 sm:block" width="20" height="14" viewBox="0 0 20 14" fill="none">
                  <path d="M1 7h16M17 7l-4-4M17 7l-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          ))}
        </div>
        <p className="mx-auto mt-6 max-w-xl text-center text-xs text-text-muted">
          <Link href="/architecture" className="text-accent-strong hover:underline">See the full architecture breakdown →</Link>
        </p>
      </div>
    </section>
  );
}

function PrinciplesSection() {
  return (
    <section className="border-b border-border px-4 py-16 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-2xl font-semibold tracking-tight text-text-primary">
          AI proposes. Policies decide. KeeperHub executes.
        </h2>
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {PRINCIPLES.map((p) => (
            <div key={p.title} className="card flex flex-col p-6">
              <div className="text-sm font-semibold text-text-primary">{p.title}</div>
              <p className="mt-2 flex-1 text-xs text-text-secondary">{p.body}</p>
              <Link href={p.href} className="mt-4 text-xs font-medium text-accent-strong hover:underline">
                {p.cta} →
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function DisclosureBanner() {
  return (
    <section className="px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-3xl rounded-xl border border-border bg-surface px-6 py-4 text-center text-xs text-text-muted">
        Mastra is not fully non-custodial today — real execution spends from KeeperHub&apos;s own shared wallet under policy-bounded
        limits, not a per-user wallet.{" "}
        <Link href="/security" className="text-accent-strong hover:underline">
          See the exact authorization boundary this build enforces →
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="px-4 py-12 sm:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 sm:flex-row sm:justify-between">
        <div className="max-w-xs">
          <div className="text-sm font-semibold text-text-primary">Mastra</div>
          <p className="mt-2 text-xs text-text-secondary">
            The execution control plane for onchain agents — real automations, a deterministic policy engine, and KeeperHub as the
            sole executor.
          </p>
        </div>
        <div className="flex flex-wrap gap-10">
          <FooterColumn
            title="Control plane"
            links={[
              { label: "Mission Control", href: "/overview" },
              { label: "Automations", href: "/automations" },
              { label: "Policies", href: "/policies" },
              { label: "Security", href: "/security" },
            ]}
          />
          <FooterColumn
            title="Transparency"
            links={[
              { label: "Integrations", href: "/integrations" },
              { label: "Audit Trail", href: "/audit" },
              { label: "Architecture", href: "/architecture" },
            ]}
          />
          <FooterColumn title="Direct" links={[{ label: "Swap", href: "/swap" }, { label: "Mastra AI", href: "/ai" }]} />
        </div>
      </div>
      <div className="mx-auto mt-10 max-w-5xl border-t border-border pt-6 text-xs text-text-muted">© 2026 Mastra.</div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-text-muted">{title}</div>
      <div className="mt-3 flex flex-col gap-2">
        {links.map((l) => (
          <Link key={l.label} href={l.href} className="text-sm text-text-secondary hover:text-accent-strong">
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
