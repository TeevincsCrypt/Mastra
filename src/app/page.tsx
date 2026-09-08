"use client";

import { useRouter } from "next/navigation";
import { useMastraStore } from "@/lib/store";
import { useHydrated } from "@/lib/useHydrated";
import { LandingPage } from "@/components/landing/LandingPage";

export default function HomePage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const connected = useMastraStore((s) => s.walletConnected);
  const connectWallet = useMastraStore((s) => s.connectWallet);

  if (!hydrated) return null;

  function handlePrimaryAction() {
    if (!connected) connectWallet();
    router.push("/dashboard");
  }

  return <LandingPage onConnect={handlePrimaryAction} connected={connected} />;
}
