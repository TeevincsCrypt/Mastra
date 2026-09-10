import { useSyncExternalStore } from "react";

// Generic client-mounted check: true only once React has actually hydrated
// in the browser, false during SSR. Used to gate any page/component that
// reads localStorage or wallet state, which don't exist on the server.
function subscribe() {
  return () => {};
}

function getSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}

export function useHydrated() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
