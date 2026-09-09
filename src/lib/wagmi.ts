import { http, createConfig } from "wagmi";
import { sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

// Sepolia only — it's the only chain KeeperHub actually executes against in
// this build. Injected connector only (MetaMask and anything else that
// injects window.ethereum) — no WalletConnect project id to sign up for,
// matching "don't introduce unnecessary wallet libraries."
export const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors: [injected()],
  transports: {
    [sepolia.id]: http(),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
