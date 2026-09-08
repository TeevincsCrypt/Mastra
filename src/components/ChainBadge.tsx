import { CHAINS } from "@/lib/mock";
import type { ChainId } from "@/lib/types";

export function ChainBadge({ chain, size = "md" }: { chain: ChainId; size?: "sm" | "md" }) {
  const meta = CHAINS[chain];
  const pad = size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${pad} font-medium`}
      style={{ borderColor: `${meta.color}40`, background: `${meta.color}14`, color: meta.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
      {meta.name}
    </span>
  );
}

export function ChainRoute({ from, to }: { from: ChainId; to: ChainId }) {
  return (
    <div className="inline-flex items-center gap-2">
      <ChainBadge chain={from} />
      <svg width="18" height="10" viewBox="0 0 18 10" fill="none" className="text-text-muted shrink-0">
        <path d="M0 5H16.5M16.5 5L12 1M16.5 5L12 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <ChainBadge chain={to} />
    </div>
  );
}
