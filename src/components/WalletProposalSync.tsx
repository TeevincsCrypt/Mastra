"use client";

import { useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import { useMastraStore } from "@/lib/store";

/**
 * Bridges real wallet connection state into the app's proposal/execution
 * state: requests a proposal once when a wallet actually connects, and
 * clears any in-progress proposal/simulation/execution when it disconnects.
 * Headless — renders nothing.
 */
export function WalletProposalSync() {
  const { isConnected } = useAccount();
  const wasConnected = useRef(false);

  useEffect(() => {
    if (isConnected && !wasConnected.current) {
      wasConnected.current = true;
      const state = useMastraStore.getState();
      if (!state.proposal) state.requestProposal();
    } else if (!isConnected && wasConnected.current) {
      wasConnected.current = false;
      useMastraStore.getState().resetActive();
    }
  }, [isConnected]);

  return null;
}
