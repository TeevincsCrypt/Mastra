"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMastraStore } from "@/lib/store";
import { useHydrated } from "@/lib/useHydrated";
import { shortHash } from "@/lib/mock";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/workflow", label: "Workflow Review" },
  { href: "/execution", label: "Execution" },
  { href: "/audit", label: "Audit Trail" },
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const hydrated = useHydrated();
  const connected = useMastraStore((s) => s.walletConnected);
  const address = useMastraStore((s) => s.walletAddress);
  const connectWallet = useMastraStore((s) => s.connectWallet);
  const disconnectWallet = useMastraStore((s) => s.disconnectWallet);

  function handleConnect() {
    connectWallet();
    router.push("/dashboard");
  }

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
        ) : connected ? (
          <button
            onClick={disconnectWallet}
            className="group flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:border-border-strong"
          >
            <span className="h-2 w-2 rounded-full bg-success" />
            <span className="font-mono text-xs text-text-secondary group-hover:text-text-primary">
              {shortHash(address ?? "", 4, 4)}
            </span>
          </button>
        ) : (
          <button
            onClick={handleConnect}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            Connect Wallet
          </button>
        )}
      </div>
    </header>
  );
}
