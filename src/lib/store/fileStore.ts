import "server-only";
import { mkdirSync, existsSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Redis } from "@upstash/redis";

/**
 * Real, server-side persistence with two real backends, not a mock either
 * way:
 *
 * 1. Redis (Upstash, via the Vercel Marketplace "Upstash" storage
 *    integration or a raw Upstash database) when KV_REST_API_URL /
 *    KV_REST_API_TOKEN (the Vercel-integration naming) or
 *    UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN (raw Upstash
 *    naming) are present. This is the real fix for Vercel: serverless
 *    function instances don't share a filesystem and don't survive cold
 *    starts, so file-based storage silently loses data across requests —
 *    confirmed in production ("Automation not found" right after a
 *    successful create). Redis is shared, real state across instances.
 * 2. A JSON file on disk otherwise — for local dev, where a long-running
 *    single process makes this behave like real durable storage. On
 *    Vercel without a Redis integration configured, this still falls back
 *    to /tmp (writable there, unlike process.cwd()) so the app doesn't
 *    crash — but data still won't survive across instances/cold starts in
 *    that fallback case. Configure Redis for anything beyond local dev.
 *
 * Every function in lib/store/ is written against this same
 * collection-of-JSON-documents shape, so callers never know which backend
 * is live.
 */

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = REDIS_URL && REDIS_TOKEN ? new Redis({ url: REDIS_URL, token: REDIS_TOKEN }) : null;

const DATA_DIR = process.env.VERCEL ? join(tmpdir(), "mastra-data") : join(process.cwd(), ".data");

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function filePath(name: string): string {
  return join(DATA_DIR, `${name}.json`);
}

function redisKey(name: string): string {
  return `mastra:${name}`;
}

export async function readCollection<T>(name: string): Promise<T[]> {
  if (redis) {
    const value = await redis.get<T[]>(redisKey(name));
    return Array.isArray(value) ? value : [];
  }
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

/** Write-to-temp-then-rename for a bit of atomicity against a crash mid-write (file backend only); does not solve concurrent-writer races across multiple readers/writers either backend — acceptable for a single-writer-at-a-time hackathon demo, documented above. */
export async function writeCollection<T>(name: string, items: T[]): Promise<void> {
  if (redis) {
    await redis.set(redisKey(name), items);
    return;
  }
  ensureDir();
  const path = filePath(name);
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(items, null, 2), "utf-8");
  renameSync(tmp, path);
}

export async function readSingleton<T>(name: string, fallback: T): Promise<T> {
  if (redis) {
    const value = await redis.get<T>(redisKey(name));
    return value ?? fallback;
  }
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

export async function writeSingleton<T>(name: string, value: T): Promise<void> {
  if (redis) {
    await redis.set(redisKey(name), value);
    return;
  }
  ensureDir();
  const path = filePath(name);
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2), "utf-8");
  renameSync(tmp, path);
}

export function isRedisBacked(): boolean {
  return redis !== null;
}
