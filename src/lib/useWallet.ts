"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { injected } from "wagmi/connectors";
import { mainnet } from "wagmi/chains";

/**
 * Thin wrapper around wagmi's hooks giving the app one real wallet API:
 * actual connection state, actual address, actual chain, real error and
 * loading states. No fake address is ever generated or stored anywhere.
 *
 * The connected wallet now genuinely signs real swaps directly — this is
 * the self-custodial execution model, where each visitor spends only their
 * own funds — so it must actually be on Ethereum mainnet to execute.
 */
export function useWallet() {
  const { address, isConnected, isConnecting, isReconnecting, chainId } = useAccount();
  const { connect, isPending, error: connectError, reset: resetConnectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const hasInjectedProvider = typeof window !== "undefined" && Boolean((window as unknown as { ethereum?: unknown }).ethereum);
  const isWrongNetwork = isConnected && chainId !== mainnet.id;

  function connectWallet() {
    resetConnectError();
    connect({ connector: injected(), chainId: mainnet.id });
  }

  function switchToMainnet() {
    switchChain({ chainId: mainnet.id });
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
    switchToMainnet,
  };
}
