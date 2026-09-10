"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";

/**
 * Thin wrapper around wagmi's hooks giving the app one real wallet API:
 * actual connection state, actual address, real error and loading states.
 * No fake address is ever generated or stored anywhere.
 *
 * There is no required network here: the connected wallet is identity only
 * — it never signs Mastra's real swaps, which execute through KeeperHub's
 * own wallet on Ethereum mainnet regardless of what chain the browser
 * wallet happens to be on.
 */
export function useWallet() {
  const { address, isConnected, isConnecting, isReconnecting } = useAccount();
  const { connect, isPending, error: connectError, reset: resetConnectError } = useConnect();
  const { disconnect } = useDisconnect();

  const hasInjectedProvider = typeof window !== "undefined" && Boolean((window as unknown as { ethereum?: unknown }).ethereum);

  function connectWallet() {
    resetConnectError();
    connect({ connector: injected() });
  }

  return {
    address,
    isConnected,
    isConnecting: isConnecting || isPending || isReconnecting,
    hasInjectedProvider,
    connectError,
    connectWallet,
    disconnect,
  };
}
