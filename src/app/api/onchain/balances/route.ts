import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { getErc20Balance } from "@/lib/onchain/allowance";
import { SUPPORTED_TOKENS } from "@/lib/tokens";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Read-only: real on-chain balance of every supported token, for any
 * address. Used for the connected visitor's own wallet — no KeeperHub
 * involved, no wallet resolution, just a plain eth_call per token.
 */

export async function GET(request: Request) {
  const address = new URL(request.url).searchParams.get("address");
  if (!address || !isAddress(address)) {
    return NextResponse.json({ ok: false, error: "A valid address query parameter is required." }, { status: 400 });
  }

  try {
    const balances = await Promise.all(
      SUPPORTED_TOKENS.map(async (token) => ({
        symbol: token.symbol,
        balance: (await getErc20Balance(token.address, address)).toString(),
      })),
    );
    return NextResponse.json({ ok: true, address, balances: Object.fromEntries(balances.map((b) => [b.symbol, b.balance])) });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error reading on-chain balances." },
      { status: 502 },
    );
  }
}
