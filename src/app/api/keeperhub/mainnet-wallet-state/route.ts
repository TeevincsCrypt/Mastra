import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/keeperhub/dynamicWorkflow";
import { getErc20Balance } from "@/lib/onchain/allowance";
import { KeeperHubError } from "@/lib/keeperhub/client";
import { SUPPORTED_TOKENS } from "@/lib/tokens";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Read-only: resolves the real KeeperHub execution wallet, then reads its
 * real on-chain balance for every supported token via a plain eth_call
 * (same pattern already proven in forensics.ts). No execute, no create,
 * no signing.
 */

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
    const balances = await Promise.all(
      SUPPORTED_TOKENS.map(async (token) => ({
        symbol: token.symbol,
        balance: (await getErc20Balance(token.address, executionWallet)).toString(),
      })),
    );
    return NextResponse.json({
      ok: true,
      executionWallet,
      balances: Object.fromEntries(balances.map((b) => [b.symbol, b.balance])),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error reading on-chain balances." },
      { status: 502 },
    );
  }
}
