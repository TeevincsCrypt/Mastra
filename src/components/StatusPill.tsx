type Tone = "neutral" | "accent" | "wayfinder" | "success" | "danger" | "warning";

const TONE_STYLES: Record<Tone, { bg: string; fg: string; border: string }> = {
  neutral: { bg: "var(--surface-hover)", fg: "var(--text-secondary)", border: "var(--border-strong)" },
  accent: { bg: "var(--accent-dim)", fg: "var(--accent-strong)", border: "rgba(34,211,238,0.35)" },
  wayfinder: { bg: "var(--wayfinder-dim)", fg: "var(--wayfinder)", border: "rgba(167,139,250,0.35)" },
  success: { bg: "var(--success-dim)", fg: "var(--success)", border: "rgba(52,211,153,0.35)" },
  danger: { bg: "var(--danger-dim)", fg: "var(--danger)", border: "rgba(248,113,113,0.35)" },
  warning: { bg: "rgba(251,191,36,0.12)", fg: "var(--warning)", border: "rgba(251,191,36,0.35)" },
};

export function StatusPill({
  tone = "neutral",
  children,
  dot = false,
  pulse = false,
}: {
  tone?: Tone;
  children: React.ReactNode;
  dot?: boolean;
  pulse?: boolean;
}) {
  const s = TONE_STYLES[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium tracking-wide"
      style={{ background: s.bg, color: s.fg, borderColor: s.border }}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${pulse ? "pulse-dot" : ""}`} style={{ background: s.fg }} />}
      {children}
    </span>
  );
}
