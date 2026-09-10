import "server-only";
import { randomUUID } from "node:crypto";
import { readCollection, writeCollection } from "./fileStore";
import type { Automation } from "./types";

const COLLECTION = "automations";

export async function listAutomations(ownerAddress?: string): Promise<Automation[]> {
  const all = await readCollection<Automation>(COLLECTION);
  const filtered = ownerAddress ? all.filter((a) => a.ownerAddress.toLowerCase() === ownerAddress.toLowerCase()) : all;
  return filtered.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getAutomation(id: string): Promise<Automation | undefined> {
  return (await readCollection<Automation>(COLLECTION)).find((a) => a.id === id);
}

export async function createAutomation(input: Omit<Automation, "id" | "createdAt" | "updatedAt">): Promise<Automation> {
  const now = Date.now();
  const automation: Automation = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
  const all = await readCollection<Automation>(COLLECTION);
  all.push(automation);
  await writeCollection(COLLECTION, all);
  return automation;
}

export async function updateAutomation(id: string, patch: Partial<Automation>): Promise<Automation | undefined> {
  const all = await readCollection<Automation>(COLLECTION);
  const idx = all.findIndex((a) => a.id === id);
  if (idx === -1) return undefined;
  all[idx] = { ...all[idx], ...patch, id: all[idx].id, updatedAt: Date.now() };
  await writeCollection(COLLECTION, all);
  return all[idx];
}
