import "server-only";
import { randomUUID } from "node:crypto";
import { readCollection, writeCollection } from "./fileStore";
import type { AuditEvent } from "./types";

const COLLECTION = "audit_events";

export function listAuditEvents(filter?: { automationId?: string; executionId?: string }): AuditEvent[] {
  const all = readCollection<AuditEvent>(COLLECTION);
  const filtered = all.filter((e) => {
    if (filter?.automationId && e.automationId !== filter.automationId) return false;
    if (filter?.executionId && e.executionId !== filter.executionId) return false;
    return true;
  });
  return filtered.sort((a, b) => b.timestamp - a.timestamp);
}

export function recordAuditEvent(input: Omit<AuditEvent, "id" | "timestamp">): AuditEvent {
  const event: AuditEvent = { ...input, id: randomUUID(), timestamp: Date.now() };
  const all = readCollection<AuditEvent>(COLLECTION);
  all.push(event);
  writeCollection(COLLECTION, all);
  return event;
}
