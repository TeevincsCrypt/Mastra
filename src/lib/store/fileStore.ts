import "server-only";
import { mkdirSync, existsSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";

/**
 * Real, server-side JSON-file persistence. Not a mock — every read and
 * write here actually hits disk and actually round-trips real data.
 *
 * Known, documented limitation: this project has no database and this
 * sandbox has no way to provision one. On a long-running process (local
 * `npm run dev`, or a single warm Vercel instance during a demo session)
 * this behaves like real durable storage. On serverless deployments across
 * multiple instances or after a cold start, the file is NOT guaranteed to
 * persist — each instance may see its own copy. This is a real, disclosed
 * constraint (see README "Known limitations"), not a hidden one. Every
 * function in lib/store/ is written against this same on-disk shape, so
 * swapping in a real database later means replacing this one file, not
 * the policy engine or the API routes that call it.
 */

const DATA_DIR = join(process.cwd(), ".data");

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function filePath(name: string): string {
  return join(DATA_DIR, `${name}.json`);
}

export function readCollection<T>(name: string): T[] {
  ensureDir();
  const path = filePath(name);
  if (!existsSync(path)) return [];
  try {
    const raw = readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    // Corrupt or partially-written file — fail safe to empty rather than crash.
    return [];
  }
}

/** Write-to-temp-then-rename for a bit of atomicity against a crash mid-write; does not solve concurrent-writer races across multiple serverless instances (a real DB would) — acceptable for a single-instance hackathon demo, documented above. */
export function writeCollection<T>(name: string, items: T[]): void {
  ensureDir();
  const path = filePath(name);
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(items, null, 2), "utf-8");
  renameSync(tmp, path);
}

export function readSingleton<T>(name: string, fallback: T): T {
  ensureDir();
  const path = filePath(name);
  if (!existsSync(path)) return fallback;
  try {
    const raw = readFileSync(path, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeSingleton<T>(name: string, value: T): void {
  ensureDir();
  const path = filePath(name);
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2), "utf-8");
  renameSync(tmp, path);
}
