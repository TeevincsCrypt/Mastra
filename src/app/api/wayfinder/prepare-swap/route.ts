import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { prepareSelfCustodialSwap } from "@/lib/wayfinder/prepareSelfCustodialSwap";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Self-custodial swap prepare: real Wayfinder quote, decoded and verified,
 * plus the connected wallet's real on-chain allowance. Read-only — nothing
 * here signs or broadcasts. The visitor's own wallet does that, using this
 * response, entirely client-side.
 */

interface RequestBody {
  fromToken?: string;
  toToken?: string;
  amount?: string;
  walletAddress?: string;
}

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.fromToken || !body.toToken || !body.amount) {
    return NextResponse.json({ ok: false, error: "fromToken, toToken and amount are required." }, { status: 400 });
  }
  if (!body.walletAddress || !isAddress(body.walletAddress)) {
    return NextResponse.json({ ok: false, error: "A valid connected walletAddress is required." }, { status: 400 });
  }

  const result = await prepareSelfCustodialSwap({
    fromToken: body.fromToken,
    toToken: body.toToken,
    amount: body.amount,
    walletAddress: body.walletAddress,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
