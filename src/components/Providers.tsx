"use client";

import { useState } from "react";
import { Buffer } from "buffer";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wagmi";

// wagmi's useSignMessage (needed for real sign-in-with-wallet, see
// lib/useAuth.ts) hits a code path that references the Node global
// `Buffer`, which this project's bundler doesn't polyfill for the browser
// by default — confirmed as a real runtime crash ("Buffer is not
// defined") during actual signature testing, not a hypothetical. Shimming
// it once, here, before any wagmi hook can run.
if (typeof window !== "undefined" && !("Buffer" in window)) {
  (window as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
