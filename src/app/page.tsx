"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/lib/useWallet";
import { useHydrated } from "@/lib/useHydrated";
import { LandingPage } from "@/components/landing/LandingPage";

export default function HomePage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const { isConnected, connectWallet } = useWallet();
  const pendingRedirect = useRef(false);

  useEffect(() => {
    if (isConnected && pendingRedirect.current) {
      pendingRedirect.current = false;
      router.push("/dashboard");
    }
  }, [isConnected, router]);

  if (!hydrated) return null;

  function handlePrimaryAction() {
    if (isConnected) {
      router.push("/dashboard");
      return;
    }
    pendingRedirect.current = true;
    connectWallet();
  }

  return <LandingPage onConnect={handlePrimaryAction} connected={isConnected} />;
}
