import { useSyncExternalStore } from "react";
import { useMastraStore } from "./store";

// zustand's persist middleware can only read localStorage in the browser, so
// `.persist` isn't populated during server rendering — guard every access.
function subscribe(callback: () => void) {
  const unsub = useMastraStore.persist?.onFinishHydration?.(callback);
  return () => unsub?.();
}

function getSnapshot() {
  return useMastraStore.persist?.hasHydrated?.() ?? true;
}

function getServerSnapshot() {
  return false;
}

export function useHydrated() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
