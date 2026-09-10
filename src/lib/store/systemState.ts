import "server-only";
import { readSingleton, writeSingleton } from "./fileStore";
import type { SystemState } from "./types";

const KEY = "system_state";
const DEFAULT_STATE: SystemState = { paused: false };

/**
 * The real, server-side emergency stop. Every state-changing execution
 * route checks this before ever calling Wayfinder or KeeperHub — not a
 * client-side flag, not a disabled button. See /api/automations/[id]/execute.
 */
export function getSystemState(): SystemState {
  return readSingleton<SystemState>(KEY, DEFAULT_STATE);
}

export function setPaused(paused: boolean, by: string): SystemState {
  const state: SystemState = paused ? { paused: true, pausedAt: Date.now(), pausedBy: by } : { paused: false };
  writeSingleton(KEY, state);
  return state;
}
