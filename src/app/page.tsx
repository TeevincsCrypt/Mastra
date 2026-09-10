"use client";

import { useRouter } from "next/navigation";
import { useHydrated } from "@/lib/useHydrated";
import { LandingPage } from "@/components/landing/LandingPage";

export default function HomePage() {
  const router = useRouter();
  const hydrated = useHydrated();

  if (!hydrated) return null;

  function handlePrimaryAction() {
    router.push("/swap");
  }

  return <LandingPage onConnect={handlePrimaryAction} />;
}
