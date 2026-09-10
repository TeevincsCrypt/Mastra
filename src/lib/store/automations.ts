import "server-only";
import { randomUUID } from "node:crypto";
import { readCollection, writeCollection } from "./fileStore";
import type { Automation } from "./types";

const COLLECTION = "automations";

export function listAutomations(ownerAddress?: string): Automation[] {
  const all = readCollection<Automation>(COLLECTION);
  const filtered = ownerAddress ? all.filter((a) => a.ownerAddress.toLowerCase() === ownerAddress.toLowerCase()) : all;
  return filtered.sort((a, b) => b.createdAt - a.createdAt);
}

export function getAutomation(id: string): Automation | undefined {
  return readCollection<Automation>(COLLECTION).find((a) => a.id === id);
}

export function createAutomation(input: Omit<Automation, "id" | "createdAt" | "updatedAt">): Automation {
  const now = Date.now();
  const automation: Automation = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
  const all = readCollection<Automation>(COLLECTION);
  all.push(automation);
  writeCollection(COLLECTION, all);
  return automation;
}

export function updateAutomation(id: string, patch: Partial<Automation>): Automation | undefined {
  const all = readCollection<Automation>(COLLECTION);
  const idx = all.findIndex((a) => a.id === id);
  if (idx === -1) return undefined;
  all[idx] = { ...all[idx], ...patch, id: all[idx].id, updatedAt: Date.now() };
  writeCollection(COLLECTION, all);
  return all[idx];
}
