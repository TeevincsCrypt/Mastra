import { createPublicClient, http, type Address } from "viem";
import { mainnet } from "viem/chains";
import { ERC20_ABI } from "./erc20Abi";

/**
 * Read-only Ethereum mainnet client. This is NOT a signer — no private key,
 * no wallet, no ability to send a transaction. It exists solely to answer
 * "what is the current on-chain allowance" via a plain eth_call, which is
 * required to decide whether an approve() step is actually needed before
 * building a KeeperHub workflow. This is not "executing through viem" in
 * the sense this project has repeatedly ruled out — that phrase refers to
 * signing and broadcasting a transaction, which nothing here does.
 *
 * Uses a public, no-API-key RPC by default; MAINNET_RPC_URL can override it
 * for reliability, but no key is required for this to function.
 */
const RPC_URL = process.env.MAINNET_RPC_URL || "https://ethereum-rpc.publicnode.com";

export const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(RPC_URL),
});

export async function getErc20Allowance(tokenAddress: string, owner: string, spender: string): Promise<bigint> {
  return publicClient.readContract({
    address: tokenAddress as Address,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [owner as Address, spender as Address],
  });
}

export async function getErc20Balance(tokenAddress: string, owner: string): Promise<bigint> {
  return publicClient.readContract({
    address: tokenAddress as Address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [owner as Address],
  });
}

/**
 * Real native ETH balance via a plain eth_getBalance call — the wallet's
 * gas budget, not a token balance. Added after a real execution failure
 * (INSUFFICIENT_FUNDS from KeeperHub's own RPC, surfaced via the audit
 * trail) that this would have shown proactively: every ERC-20 balance
 * check can pass while the wallet still can't afford to pay gas for the
 * transaction that would move them.
 */
export async function getEthBalance(owner: string): Promise<bigint> {
  return publicClient.getBalance({ address: owner as Address });
}
