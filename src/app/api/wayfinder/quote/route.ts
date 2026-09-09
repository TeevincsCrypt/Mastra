import { NextResponse } from "next/server";
import { quoteSwap, WayfinderError } from "@/lib/wayfinder/client";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface QuoteRequestBody {
  fromToken?: string;
  toToken?: string;
  amount?: string;
  slippageBps?: number;
}

export async function POST(request: Request) {
  let body: QuoteRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.fromToken || !body.toToken || !body.amount) {
    return NextResponse.json(
      { ok: false, error: "fromToken, toToken and amount are required." },
      { status: 400 },
    );
  }

  try {
    const quote = await quoteSwap({
      fromToken: body.fromToken,
      toToken: body.toToken,
      amount: body.amount,
      slippageBps: body.slippageBps,
    });
    return NextResponse.json({ ok: true, quote });
  } catch (err) {
    if (err instanceof WayfinderError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 502 });
    }
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown Wayfinder error." },
      { status: 500 },
    );
  }
}
