/**
 * Real swap attempt history, persisted to this browser's localStorage only
 * (not shared across viewers or devices — see /swap and /audit, the two
 * pages that read and write it). Every entry here comes from an actual
 * KeeperHub execute() response; nothing is synthesized.
 */

export interface HistoryEntry {
  timestamp: number;
  amountLabel: string;
  fromSymbol: string;
  toSymbol: string;
  status: "success" | "reverted" | "failed";
  txHash?: string;
  workflowId?: string;
  error?: string;
}

const HISTORY_KEY = "mastra-swap-history";
const HISTORY_LIMIT = 50;

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveHistory(entries: HistoryEntry[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, HISTORY_LIMIT)));
  } catch {
    // Best-effort — history is a convenience, not required for the swap itself.
  }
}
