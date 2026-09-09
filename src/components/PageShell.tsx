"use client";

import { useWallet } from "@/lib/useWallet";

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
  const { isConnected, isConnecting, isWrongNetwork, isSwitching, hasInjectedProvider, connectError, connectWallet, switchToSepolia } =
    useWallet();

  if (isConnected && isWrongNetwork) {
    return (
      <div className="card flex flex-col items-center gap-4 px-8 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-warning/40 bg-warning/10">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 8v5M12 16.5h.01" stroke="var(--warning)" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M10.3 3.9 2.6 17a1.5 1.5 0 0 0 1.3 2.2h16.2a1.5 1.5 0 0 0 1.3-2.2L13.7 3.9a1.5 1.5 0 0 0-2.6 0Z" stroke="var(--warning)" strokeWidth="1.4" />
          </svg>
        </div>
        <p className="max-w-sm text-sm text-text-secondary">
          Your wallet is connected to the wrong network. Mastra&apos;s KeeperHub execution runs on Sepolia — switch to
          continue.
        </p>
        <button
          onClick={switchToSepolia}
          disabled={isSwitching}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
        >
          {isSwitching ? "Switching…" : "Switch to Sepolia"}
        </button>
      </div>
    );
  }

  return (
    <div className="card flex flex-col items-center gap-4 px-8 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border-strong bg-surface-hover">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M3 7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v1h2a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" stroke="var(--text-secondary)" strokeWidth="1.4" />
          <circle cx="16.5" cy="14" r="1.4" fill="var(--text-secondary)" />
        </svg>
      </div>
      <p className="max-w-sm text-sm text-text-secondary">{message}</p>
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
  );
}
