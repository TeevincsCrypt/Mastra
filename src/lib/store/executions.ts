import "server-only";
import { randomUUID } from "node:crypto";
import { readCollection, writeCollection } from "./fileStore";
import type { ExecutionRecord } from "./types";

const COLLECTION = "executions";

export async function listExecutions(automationId?: string): Promise<ExecutionRecord[]> {
  const all = await readCollection<ExecutionRecord>(COLLECTION);
  const filtered = automationId ? all.filter((e) => e.automationId === automationId) : all;
  return filtered.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getExecution(id: string): Promise<ExecutionRecord | undefined> {
  return (await readCollection<ExecutionRecord>(COLLECTION)).find((e) => e.id === id);
}

export async function createExecution(input: Omit<ExecutionRecord, "id" | "createdAt">): Promise<ExecutionRecord> {
  const record: ExecutionRecord = { ...input, id: randomUUID(), createdAt: Date.now() };
  const all = await readCollection<ExecutionRecord>(COLLECTION);
  all.push(record);
  await writeCollection(COLLECTION, all);
  return record;
}

export async function updateExecution(id: string, patch: Partial<ExecutionRecord>): Promise<ExecutionRecord | undefined> {
  const all = await readCollection<ExecutionRecord>(COLLECTION);
  const idx = all.findIndex((e) => e.id === id);
  if (idx === -1) return undefined;
  all[idx] = { ...all[idx], ...patch, id: all[idx].id };
  await writeCollection(COLLECTION, all);
  return all[idx];
}

/**
 * Real spend accounting: sums requestedAmount across executions that
 * actually reached KeeperHub's execute() call (keeperhubExecuteCalled)
 * and succeeded, within the given window. A blocked or failed-before-
 * execute attempt never counted against budget in reality (no funds
 * moved), so it's excluded here — this must match what actually happened
 * on-chain, not what was merely attempted.
 */
export async function sumSpentSince(automationIds: string[], sinceMs: number): Promise<number> {
  const all = await readCollection<ExecutionRecord>(COLLECTION);
  return all
    .filter(
      (e) =>
        automationIds.includes(e.automationId) &&
        e.keeperhubExecuteCalled &&
        e.status === "success" &&
        e.createdAt >= sinceMs,
    )
    .reduce((sum, e) => sum + (Number(e.requestedAmount) || 0), 0);
}
