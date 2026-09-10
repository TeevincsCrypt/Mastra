import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/keeperhub/dynamicWorkflow";
import { getErc20Balance } from "@/lib/onchain/allowance";
import { KeeperHubError } from "@/lib/keeperhub/client";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Read-only: resolves the real KeeperHub execution wallet, then reads its
 * real on-chain USDC/WETH balances via a plain eth_call (same pattern
 * already proven in forensics.ts). No execute, no create, no signing.
 */

const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

export async function GET() {
  let executionWallet: string;
  try {
    const { body } = await getCurrentUser();
    const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    if (typeof record.walletAddress !== "string" || !record.walletAddress) {
      return NextResponse.json({ ok: false, error: "GET /api/user did not return a walletAddress." }, { status: 502 });
    }
    executionWallet = record.walletAddress;
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof KeeperHubError ? err.message : err instanceof Error ? err.message : "Unknown error." },
      { status: 502 },
    );
  }

  try {
    const [usdcBalance, wethBalance] = await Promise.all([
      getErc20Balance(USDC_ADDRESS, executionWallet),
      getErc20Balance(WETH_ADDRESS, executionWallet),
    ]);
    return NextResponse.json({
      ok: true,
      executionWallet,
      usdcBalance: usdcBalance.toString(),
      wethBalance: wethBalance.toString(),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error reading on-chain balances." },
      { status: 502 },
    );
  }
}
