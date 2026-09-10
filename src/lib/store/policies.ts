import "server-only";
import { randomUUID } from "node:crypto";
import { readCollection, writeCollection } from "./fileStore";
import type { Policy } from "./types";
import { VERIFIED_ROUTER_ADDRESS } from "@/lib/wayfinder/executeCalldata";

const COLLECTION = "policies";

export const DEFAULT_POLICY_DEFAULTS = {
  allowedChains: ["1"],
  maxSlippageBps: 100,
  allowedRouters: [VERIFIED_ROUTER_ADDRESS],
  requireFreshQuote: true,
  quoteExpirySeconds: 120,
  requirePreflight: true,
  requireApprovalHash: true,
};

export function getPolicy(id: string): Policy | undefined {
  return readCollection<Policy>(COLLECTION).find((p) => p.id === id);
}

export function getPolicyForAutomation(automationId: string): Policy | undefined {
  return readCollection<Policy>(COLLECTION).find((p) => p.automationId === automationId);
}

export function createPolicy(input: Omit<Policy, "id" | "createdAt" | "updatedAt">): Policy {
  const now = Date.now();
  const policy: Policy = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
  const all = readCollection<Policy>(COLLECTION);
  all.push(policy);
  writeCollection(COLLECTION, all);
  return policy;
}

export function updatePolicy(id: string, patch: Partial<Policy>): Policy | undefined {
  const all = readCollection<Policy>(COLLECTION);
  const idx = all.findIndex((p) => p.id === id);
  if (idx === -1) return undefined;
  all[idx] = { ...all[idx], ...patch, id: all[idx].id, updatedAt: Date.now() };
  writeCollection(COLLECTION, all);
  return all[idx];
}
