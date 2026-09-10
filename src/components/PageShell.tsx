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
