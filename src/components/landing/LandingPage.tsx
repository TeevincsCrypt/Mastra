"use client";

import { useState } from "react";

const GREEN = "#059669";

export function LandingPage({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="bg-white text-slate-900">
      <Hero onConnect={onConnect} />
      <IntegrationStrip />
      <FlowSection />
      <ApprovalSection />
      <VerifySection />
      <ExecuteSection />
      <CtaBanner onConnect={onConnect} />
      <Footer />
    </div>
  );
}

/* ---------------------------------- Hero --------------------------------- */

function Hero({ onConnect }: { onConnect: () => void }) {
  return (
    <section className="px-4 pt-10 sm:px-8">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[32px] bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 px-6 pb-28 pt-12 text-center sm:px-12 sm:pt-16">
        <HeroBackdrop />

        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-white pulse-dot" />
            Wayfinder × KeeperHub Execution Center
          </span>

          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl">
            Approve Every Agent Workflow, Fast and Verified, with Mastra
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-sm text-emerald-50/90 sm:text-base">
            Wayfinder finds the route. Mastra shows you exactly what it will do. KeeperHub
            executes only what you approved on real Ethereum mainnet — nothing reinterpreted.
          </p>

          <div className="mx-auto mt-8 flex w-fit flex-col items-center gap-3 rounded-2xl border border-white/20 bg-white/10 p-2 pl-5 backdrop-blur-sm sm:flex-row">
            <span className="text-sm text-white/80">Non-custodial · Ethereum mainnet</span>
            <button
              onClick={onConnect}
              className="flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-emerald-700 transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Go to Swap
              <ArrowIcon />
            </button>
          </div>
          <a href="#flow" className="mt-4 block text-xs font-medium text-white/70 underline-offset-4 hover:text-white hover:underline">
            See how the flow works ↓
          </a>
        </div>
      </div>

      <div className="relative z-10 mx-auto -mt-16 grid max-w-4xl grid-cols-1 gap-4 px-2 sm:grid-cols-[0.8fr_1.2fr_0.9fr] sm:px-0">
        <FloatCard className="sm:translate-y-3">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 pulse-dot" />
            Route verified
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">100%</div>
          <div className="text-xs text-slate-400">of approved swaps</div>
        </FloatCard>

        <FloatCard className="sm:-translate-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-violet-100 text-violet-600">
                <WayfinderIcon />
              </span>
              Wayfinder quote
            </div>
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600">Awaiting review</span>
          </div>
          <div className="mt-3 text-xl font-semibold text-slate-900">Swap 1.2 USDC</div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
            USDC <ArrowRightSmall /> WETH · Ethereum mainnet
          </div>
        </FloatCard>

        <FloatCard className="sm:translate-y-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-xs font-semibold text-white">
              0x
            </span>
            <div>
              <div className="text-xs font-medium text-slate-700">0x7770…51f8</div>
              <div className="text-[11px] text-emerald-600">● Mainnet · Confirmed</div>
            </div>
          </div>
        </FloatCard>
      </div>
    </section>
  );
}

function HeroBackdrop() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-40" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="g1" cx="20%" cy="15%" r="60%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="g2" cx="85%" cy="80%" r="55%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#g1)" />
      <rect width="100%" height="100%" fill="url(#g2)" />
    </svg>
  );
}

function FloatCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_20px_45px_-15px_rgba(15,23,42,0.18)] ${className}`}>
      {children}
    </div>
  );
}

/* ------------------------------ Integrations ------------------------------ */

const INTEGRATIONS = [
  { name: "Wayfinder", color: "#a78bfa" },
  { name: "KeeperHub", color: GREEN },
  { name: "Ethereum", color: "#8C8C8C" },
  { name: "Uniswap", color: "#FF007A" },
  { name: "Curve", color: "#3465A4" },
  { name: "Balancer", color: "#1E1E1E" },
];

function IntegrationStrip() {
  return (
    <section className="px-4 py-16 sm:px-8">
      <p className="text-center text-sm font-medium text-slate-500">
        Built on the <span className="text-emerald-600">onchain agent stack</span>
      </p>
      <div className="mx-auto mt-6 flex max-w-3xl flex-wrap items-center justify-center gap-3">
        {INTEGRATIONS.map((item) => (
          <span
            key={item.name}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600"
          >
            <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
            {item.name}
          </span>
        ))}
      </div>
    </section>
  );
}

/* --------------------------------- Flow tabs ------------------------------- */

const TABS = [
  {
    key: "propose",
    label: "Quote",
    icon: <DocIcon />,
    heading: "Wayfinder finds the exact route",
    body: "Every action, contract, and amount is decoded and laid out in plain view before anything is signed or sent — no black-box agent behavior.",
  },
  {
    key: "verify",
    label: "Verify",
    icon: <ShieldIcon />,
    heading: "Checked against live chain state",
    body: "The router is checked against a verified allowlist, your real on-chain allowance is read directly, and an approval-hash is computed over exactly what you're about to approve.",
  },
  {
    key: "execute",
    label: "Execution",
    icon: <BoltIcon />,
    heading: "Execution matches the review, exactly",
    body: "Immediately before execution, that hash is recomputed against what's actually stored in KeeperHub — if anything changed since you approved it, execution is refused automatically.",
  },
];

function FlowSection() {
  const [active, setActive] = useState(TABS[0].key);
  const tab = TABS.find((t) => t.key === active)!;

  return (
    <section id="flow" className="px-4 py-16 sm:px-8">
      <div className="mx-auto max-w-3xl text-center">
        <Eyebrow>Mastra execution flow</Eyebrow>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          Full visibility into every agent workflow, <span className="text-emerald-600">before it executes</span>
        </h2>
      </div>

      <div className="mx-auto mt-8 flex w-fit gap-1 rounded-full border border-slate-200 bg-slate-50 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              t.key === active ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <span className={t.key === active ? "text-emerald-600" : "text-slate-400"}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div className="mx-auto mt-8 max-w-2xl rounded-3xl border border-slate-100 bg-slate-50 p-8 text-center sm:p-10">
        <h3 className="text-lg font-semibold text-slate-900">{tab.heading}</h3>
        <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">{tab.body}</p>
      </div>
    </section>
  );
}

/* ------------------------------- Approval ------------------------------- */

function ApprovalSection() {
  return (
    <SplitSection
      eyebrow="Mastra approval"
      heading={
        <>
          Nothing executes until <span className="text-emerald-600">you approve it</span>
        </>
      }
      body="Every proposed workflow waits for an explicit decision. Reject it and it goes nowhere. Approve it and KeeperHub executes exactly that — down to the contract address."
    >
      <div className="w-full max-w-sm rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_25px_55px_-20px_rgba(15,23,42,0.2)]">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Workflow review</span>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-600">Route verified</span>
        </div>
        <div className="mt-3 text-base font-semibold text-slate-900">Swap 1.2 USDC · USDC → WETH</div>
        <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-xs">
          <Row label="Router" value="Verified router (Uniswap V3)" />
          <Row label="Amount" value="1.2 USDC" />
          <Row label="Network" value="Ethereum mainnet" />
        </div>
        <div className="mt-5 flex gap-2">
          <span className="flex-1 rounded-lg border border-slate-200 py-2 text-center text-xs font-medium text-slate-500">Reject</span>
          <span className="flex-1 rounded-lg bg-emerald-600 py-2 text-center text-xs font-semibold text-white">Approve &amp; Execute</span>
        </div>
      </div>
    </SplitSection>
  );
}

/* -------------------------------- Verify -------------------------------- */

function VerifySection() {
  return (
    <SplitSection
      reverse
      eyebrow="Mastra verification"
      heading={
        <>
          Every action <span className="text-emerald-600">verified</span> before it runs
        </>
      }
      body="Mastra checks the router against a verified allowlist and reads your real on-chain allowance directly — catching a mismatched route or an unverified contract before you ever sign."
    >
      <div className="relative w-full max-w-sm">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_25px_55px_-20px_rgba(15,23,42,0.2)]">
          <div className="text-xs font-medium text-slate-400">Pre-execution checks</div>
          <div className="mt-3 space-y-2.5">
            {["Router address verified", "Real on-chain allowance checked", "Approval-hash matches exactly"].map((c) => (
              <div key={c} className="flex items-center gap-2 text-xs text-slate-600">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckIcon />
                </span>
                {c}
              </div>
            ))}
          </div>
        </div>
        <FloatingChip className="-left-6 -top-4">✓ Verified</FloatingChip>
        <FloatingChip className="-right-4 top-10">✓ Verified</FloatingChip>
        <FloatingChip className="-bottom-4 left-8">✓ Verified</FloatingChip>
      </div>
    </SplitSection>
  );
}

function FloatingChip({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`absolute hidden rounded-full border border-emerald-100 bg-white px-3 py-1 text-[11px] font-medium text-emerald-600 shadow-md sm:block ${className}`}
    >
      {children}
    </span>
  );
}

/* -------------------------------- Execute -------------------------------- */

const EXECUTE_FEATURES = [
  { label: "Exact workflow execution", icon: <BoltIcon /> },
  { label: "Full audit trail", icon: <DocIcon /> },
  { label: "Real-time status", icon: <PulseIcon /> },
  { label: "No blind signing", icon: <ShieldIcon /> },
];

function ExecuteSection() {
  return (
    <section className="px-4 py-16 sm:px-8">
      <div className="mx-auto grid max-w-5xl items-center gap-10 sm:grid-cols-2">
        <div>
          <Eyebrow>Mastra execution</Eyebrow>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            From approval to <span className="text-emerald-600">confirmation</span> in seconds
          </h2>
          <p className="mt-3 max-w-md text-sm text-slate-500">
            Watch each step confirm live as KeeperHub executes — then land straight in Mastra&apos;s audit trail with
            the real transaction hash.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            {EXECUTE_FEATURES.map((f) => (
              <div key={f.label} className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">{f.icon}</span>
                {f.label}
              </div>
            ))}
          </div>
        </div>

        <div className="justify-self-center rounded-2xl border border-slate-100 bg-white p-6 text-center shadow-[0_25px_55px_-20px_rgba(15,23,42,0.2)]">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckIcon size={18} />
          </div>
          <div className="mt-3 text-sm font-semibold text-slate-900">Transaction Confirmed</div>
          <div className="mt-1 font-mono text-[11px] text-slate-400">0x630c0113…0d1eb6b7</div>
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-600">
            <ChainDot color="#8C8C8C" /> Ethereum Mainnet
          </div>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------- CTA ----------------------------------- */

function CtaBanner({ onConnect }: { onConnect: () => void }) {
  return (
    <section className="px-4 py-16 sm:px-8">
      <div className="mx-auto max-w-5xl rounded-[32px] bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 px-8 py-14 text-center">
        <h2 className="mx-auto max-w-lg text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Start verifying your agent&apos;s next move
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-sm text-emerald-50/90">
          A real Wayfinder route, verified and executed on Ethereum mainnet — reviewed before it runs.
        </p>
        <button
          onClick={onConnect}
          className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-emerald-700 transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          Go to Swap
          <ArrowIcon />
        </button>
      </div>
    </section>
  );
}

/* -------------------------------- Footer --------------------------------- */

function Footer() {
  return (
    <footer className="border-t border-slate-100 px-4 py-12 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 sm:flex-row sm:justify-between">
        <div className="max-w-xs">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <MastraMark />
            </span>
            <span className="text-sm font-semibold text-slate-900">Mastra</span>
          </div>
          <p className="mt-3 text-sm text-slate-500">
            The execution control center for onchain agents — every workflow reviewed, verified and audited before
            it runs.
          </p>
        </div>

        <div className="flex flex-wrap gap-12">
          <FooterColumn
            title="Product"
            links={[
              { label: "Swap", href: "/swap" },
              { label: "Audit Trail", href: "/audit" },
              { label: "Mastra AI", href: "/ai" },
            ]}
          />
          <FooterColumn title="Ecosystem" links={[{ label: "Wayfinder", href: "#" }, { label: "KeeperHub", href: "#" }]} />
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Connect</div>
            <div className="mt-3 flex gap-2">
              <SocialIcon icon={<GithubIcon />} />
              <SocialIcon icon={<TwitterIcon />} />
              <SocialIcon icon={<DiscordIcon />} />
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-10 max-w-6xl border-t border-slate-100 pt-6 text-xs text-slate-400">
        © 2026 Mastra. All rights reserved.
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</div>
      <div className="mt-3 flex flex-col gap-2">
        {links.map((l) => (
          <a key={l.label} href={l.href} className="text-sm text-slate-600 hover:text-emerald-600">
            {l.label}
          </a>
        ))}
      </div>
    </div>
  );
}

function SocialIcon({ icon }: { icon: React.ReactNode }) {
  return (
    <a
      href="#"
      className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:border-emerald-300 hover:text-emerald-600"
    >
      {icon}
    </a>
  );
}

/* -------------------------------- Shared bits ------------------------------ */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      {children}
    </span>
  );
}

function SplitSection({
  eyebrow,
  heading,
  body,
  children,
  reverse,
}: {
  eyebrow: string;
  heading: React.ReactNode;
  body: string;
  children: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <section className="px-4 py-16 sm:px-8">
      <div className={`mx-auto grid max-w-5xl items-center gap-10 sm:grid-cols-2 ${reverse ? "sm:[&>*:first-child]:order-2" : ""}`}>
        <div className="text-center sm:text-left">
          <div className="flex justify-center sm:justify-start">
            <Eyebrow>{eyebrow}</Eyebrow>
          </div>
          <h2 className="mx-auto mt-4 max-w-md text-3xl font-semibold tracking-tight text-slate-900 sm:mx-0 sm:text-4xl">
            {heading}
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-slate-500 sm:mx-0">{body}</p>
        </div>
        <div className="flex justify-center">{children}</div>
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-slate-700">{value}</span>
    </div>
  );
}

function ChainDot({ color }: { color: string }) {
  return <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: color }} />;
}

function ArrowRightSmall() {
  return (
    <svg width="10" height="8" viewBox="0 0 14 10" fill="none">
      <path d="M0 5H12.5M12.5 5L8 1M12.5 5L8 9" stroke="#94a3b8" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M3 7H11M11 7L7.5 3.5M11 7L7.5 10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <path d="M2 7.5L5.2 10.5L12 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M4 2h6l3 3v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M6 8h4M6 10.5h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M8 1.5 13.5 3.5V7.5C13.5 11 11 13 8 14.5C5 13 2.5 11 2.5 7.5V3.5L8 1.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M5.5 8L7.3 9.8L10.5 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M9 1.5 3 9h4l-1 5.5L13 7H9l1-5.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function PulseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M1.5 8H5l1.5-4L9 12l1.5-4h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WayfinderIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path d="M8 1L14.5 4.6V11.4L8 15L1.5 11.4V4.6L8 1Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function MastraMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M8 1L14.5 4.6V11.4L8 15L1.5 11.4V4.6L8 1Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M8 8L14.5 4.6M8 8V15M8 8L1.5 4.6" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.08.55-.17.55-.38v-1.35c-2.22.48-2.69-1.07-2.69-1.07-.36-.93-.89-1.17-.89-1.17-.72-.5.06-.49.06-.49.8.06 1.22.82 1.22.82.71 1.22 1.87.87 2.33.66.07-.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.03 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

function TwitterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M12.6 1.5h2.45l-5.35 6.1 6.3 8.4h-4.93L7.2 10.9l-4.24 4.9H.5l5.72-6.53L.2 1.5h5.05l3.5 4.63L12.6 1.5Zm-.86 12.98h1.36L4.32 2.9H2.86l8.88 11.58Z" />
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M13.5 3.4A12.7 12.7 0 0 0 10.6 2.4l-.15.3a9 9 0 0 1 2.5 1c-1.06-.5-2.1-.8-3.13-.9a10 10 0 0 0-3.64 0c-1.03.1-2.07.4-3.13.9a9 9 0 0 1 2.6-1.02l-.14-.28a12.7 12.7 0 0 0-2.9 1c-1.83 2.7-2.33 5.3-2.08 7.87a12.8 12.8 0 0 0 3.9 1.98l.48-.78a8.3 8.3 0 0 1-1.3-.63c.11-.08.22-.16.32-.25a9.2 9.2 0 0 0 7.9 0c.1.09.21.17.32.25-.4.24-.84.45-1.3.63l.48.78a12.8 12.8 0 0 0 3.9-1.98c.3-3-.5-5.58-2.18-7.87ZM5.85 9.9c-.62 0-1.13-.57-1.13-1.27s.5-1.28 1.13-1.28 1.14.58 1.13 1.28c0 .7-.5 1.27-1.13 1.27Zm4.3 0c-.62 0-1.13-.57-1.13-1.27s.5-1.28 1.13-1.28 1.14.58 1.13 1.28c0 .7-.5 1.27-1.13 1.27Z" />
    </svg>
  );
}
