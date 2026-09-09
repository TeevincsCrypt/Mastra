/**
 * Security invariant: the workflow KeeperHub executes must be exactly the
 * workflow the user approved. This hashes a canonical (key-sorted) JSON
 * representation of whatever was approved, so it can be recomputed
 * immediately before execution and compared — any change invalidates the
 * approval rather than silently executing something else.
 */
export async function hashApprovedWorkflow(value: unknown): Promise<string> {
  const canonical = canonicalize(value);
  const bytes = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(record[k])}`).join(",")}}`;
}
