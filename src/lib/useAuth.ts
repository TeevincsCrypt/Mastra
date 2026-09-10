"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";

/**
 * Real sign-in-with-wallet: fetches a challenge, has the connected wallet
 * sign it (a real signature, no gas, no transaction), and verifies it
 * server-side to issue a real session cookie. This is the actual
 * authorization boundary for creating/executing automations — not the
 * fact that a wallet happens to be connected.
 */
export function useAuth() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [authenticated, setAuthenticated] = useState(false);
  const [authenticatedAddress, setAuthenticatedAddress] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => {
        setAuthenticated(Boolean(data.authenticated));
        setAuthenticatedAddress(data.address ?? null);
      })
      .catch(() => {
        setAuthenticated(false);
        setAuthenticatedAddress(null);
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Derived, not effect-driven: a session only counts as "authenticated" while
  // the wallet that owns it is still the one actually connected.
  const walletMatchesSession = isConnected && authenticatedAddress != null && authenticatedAddress.toLowerCase() === (address ?? "").toLowerCase();
  const effectiveAuthenticated = authenticated && walletMatchesSession;

  async function signIn() {
    if (!address) return;
    setSigningIn(true);
    setError(null);
    try {
      const challengeRes = await fetch("/api/auth/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const challengeData = await challengeRes.json();
      if (!challengeRes.ok || !challengeData.ok) throw new Error(challengeData.error ?? "Failed to get a challenge.");

      const signature = await signMessageAsync({ message: challengeData.message });

      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, message: challengeData.message, signature }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.ok) throw new Error(verifyData.error ?? "Signature verification failed.");

      setAuthenticated(true);
      setAuthenticatedAddress(verifyData.address);
    } catch (err) {
      const rejected = err instanceof Error && err.message.toLowerCase().includes("user rejected");
      setError(rejected ? "You declined the signature request." : err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setSigningIn(false);
    }
  }

  async function signOut() {
    await fetch("/api/auth/session", { method: "DELETE" }).catch(() => {});
    setAuthenticated(false);
    setAuthenticatedAddress(null);
  }

  return { authenticated: effectiveAuthenticated, authenticatedAddress, signingIn, error, signIn, signOut };
}
