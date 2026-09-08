"use client";

import { useMastraStore } from "@/lib/store";

export function PageShell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-6xl px-6 py-10">{children}</div>;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-muted">{eyebrow}</div>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-text-secondary">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ConnectWalletPrompt({ message }: { message: string }) {
  const connectWallet = useMastraStore((s) => s.connectWallet);
  return (
    <div className="card flex flex-col items-center gap-4 px-8 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border-strong bg-surface-hover">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M3 7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v1h2a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" stroke="var(--text-secondary)" strokeWidth="1.4" />
          <circle cx="16.5" cy="14" r="1.4" fill="var(--text-secondary)" />
        </svg>
      </div>
      <p className="max-w-sm text-sm text-text-secondary">{message}</p>
      <button
        onClick={connectWallet}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
      >
        Connect Wallet
      </button>
    </div>
  );
}
