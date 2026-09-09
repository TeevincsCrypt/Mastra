"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { injected } from "wagmi/connectors";
import { sepolia } from "wagmi/chains";

/**
 * Thin wrapper around wagmi's hooks giving the app one real wallet API:
 * actual connection state, actual address, actual chain, real error and
 * loading states. No fake address is ever generated or stored anywhere.
 */
export function useWallet() {
  const { address, isConnected, isConnecting, isReconnecting, chainId } = useAccount();
  const { connect, isPending, error: connectError, reset: resetConnectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const hasInjectedProvider = typeof window !== "undefined" && Boolean((window as unknown as { ethereum?: unknown }).ethereum);
  const isWrongNetwork = isConnected && chainId !== sepolia.id;

  function connectWallet() {
    resetConnectError();
    connect({ connector: injected(), chainId: sepolia.id });
  }

  function switchToSepolia() {
    switchChain({ chainId: sepolia.id });
  }

  return {
    address,
    isConnected,
    isConnecting: isConnecting || isPending || isReconnecting,
    isWrongNetwork,
    isSwitching,
    hasInjectedProvider,
    connectError,
    connectWallet,
    disconnect,
    switchToSepolia,
  };
}
