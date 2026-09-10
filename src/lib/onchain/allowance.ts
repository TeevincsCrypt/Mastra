import { createPublicClient, http, type Address } from "viem";
import { mainnet } from "viem/chains";

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

const ERC20_ABI = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

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
