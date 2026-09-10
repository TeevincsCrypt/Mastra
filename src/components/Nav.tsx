"use client";

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

export function Nav() {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const { address, isConnected, isConnecting, hasInjectedProvider, connectWallet, disconnect } = useWallet();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
        <div className="flex items-center gap-8">
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

        {!hydrated ? (
          <div className="h-9 w-32 rounded-lg bg-surface" />
        ) : isConnected ? (
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
        ) : (
          <button
            onClick={connectWallet}
            disabled={isConnecting}
            title={hasInjectedProvider ? undefined : "No browser wallet detected — install one like MetaMask"}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isConnecting ? "Connecting…" : "Connect Wallet"}
          </button>
        )}
      </div>
    </header>
  );
}
