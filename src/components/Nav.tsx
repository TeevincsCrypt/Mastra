"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@/lib/useWallet";
import { useHydrated } from "@/lib/useHydrated";
import { shortHash } from "@/lib/format";

const LINKS = [
  { href: "/swap", label: "Swap" },
  { href: "/audit", label: "Audit Trail" },
  { href: "/ai", label: "Mastra AI" },
];

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-accent/40 bg-accent-dim">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 1L14.5 4.6V11.4L8 15L1.5 11.4V4.6L8 1Z" stroke="var(--accent)" strokeWidth="1.3" strokeLinejoin="round" />
          <path d="M8 8L14.5 4.6M8 8V15M8 8L1.5 4.6" stroke="var(--accent)" strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-[15px] font-semibold tracking-tight text-text-primary">Mastra</span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">Execution Control</span>
      </span>
    </Link>
  );
}

function WalletButton() {
  const hydrated = useHydrated();
  const { address, isConnected, isConnecting, hasInjectedProvider, connectWallet, disconnect } = useWallet();

  if (!hydrated) return <div className="h-9 w-32 rounded-lg bg-surface" />;

  if (isConnected) {
    return (
      <button
        onClick={() => disconnect()}
        className="group flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:border-border-strong"
        title="Click to disconnect"
      >
        <span className="h-2 w-2 rounded-full bg-success" />
        <span className="font-mono text-xs text-text-secondary group-hover:text-text-primary">
          {shortHash(address ?? "", 4, 4)}
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={connectWallet}
      disabled={isConnecting}
      title={hasInjectedProvider ? undefined : "No browser wallet detected — install one like MetaMask"}
      className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isConnecting ? "Connecting…" : "Connect Wallet"}
    </button>
  );
}

export function Nav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
    <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
        <div className="flex items-center gap-8">
          <Logo />

          <nav className="hidden items-center gap-1 md:flex">
            {LINKS.map((link) => {
              const active = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-surface-hover text-text-primary"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:block">
            <WalletButton />
          </div>

          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-strong text-text-secondary transition-colors hover:border-accent/50 hover:text-accent md:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M2.5 5h13M2.5 9h13M2.5 13h13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
    </header>

    {mobileOpen && (
      <div className="md:hidden">
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
        <div className="fixed inset-y-0 right-0 z-50 flex w-72 max-w-[85vw] flex-col gap-6 border-l border-border bg-bg px-5 py-5 shadow-xl">
          <div className="flex items-center justify-between">
            <Logo />
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-strong text-text-secondary hover:border-accent/50 hover:text-accent"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <nav className="flex flex-col gap-1">
            {LINKS.map((link) => {
              const active = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-surface-hover text-text-primary"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto">
            <WalletButton />
          </div>
        </div>
      </div>
    )}
    </>
  );
}
