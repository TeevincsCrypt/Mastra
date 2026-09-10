export function shortHash(hash: unknown, lead = 6, tail = 4) {
  if (typeof hash !== "string" || !hash) return "";
  return `${hash.slice(0, lead + 2)}…${hash.slice(-tail)}`;
}

export function formatUnits(raw: string, decimals: number, maxFractionDigits = 6): string {
  const n = Number(raw) / 10 ** decimals;
  return n.toLocaleString(undefined, { maximumFractionDigits: maxFractionDigits });
}
