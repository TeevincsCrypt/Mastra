type Tone = "neutral" | "accent" | "wayfinder" | "success" | "danger" | "warning";

const TONE_STYLES: Record<Tone, { bg: string; fg: string; border: string }> = {
  neutral: { bg: "var(--surface-hover)", fg: "var(--text-secondary)", border: "var(--border-strong)" },
  accent: { bg: "var(--accent-dim)", fg: "var(--accent-strong)", border: "rgba(5,150,105,0.3)" },
  wayfinder: { bg: "var(--wayfinder-dim)", fg: "var(--wayfinder)", border: "rgba(124,58,237,0.3)" },
  success: { bg: "var(--success-dim)", fg: "var(--success)", border: "rgba(5,150,105,0.3)" },
  danger: { bg: "var(--danger-dim)", fg: "var(--danger)", border: "rgba(220,38,38,0.3)" },
  warning: { bg: "var(--warning-dim)", fg: "var(--warning)", border: "rgba(217,119,6,0.3)" },
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
