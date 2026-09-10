import { http, createConfig } from "wagmi";
import { mainnet } from "wagmi/chains";
import { injected } from "wagmi/connectors";

// The connected wallet is identity/display only — Mastra's real swaps
// execute through KeeperHub's own wallet, never this one, so no chain is
// actually required here. Configured as mainnet to match what the product
// does. Injected connector only (MetaMask and anything else that injects
// window.ethereum) — no WalletConnect project id to sign up for, matching
// "don't introduce unnecessary wallet libraries."
export const wagmiConfig = createConfig({
  chains: [mainnet],
  connectors: [injected()],
  transports: {
    [mainnet.id]: http(),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
