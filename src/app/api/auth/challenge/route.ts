import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { buildChallengeMessage } from "@/lib/auth/siwe";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { address?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.address || !isAddress(body.address)) {
    return NextResponse.json({ ok: false, error: "A valid address is required." }, { status: 400 });
  }
  const issuedAt = Date.now();
  return NextResponse.json({ ok: true, message: buildChallengeMessage(body.address, issuedAt) });
}
