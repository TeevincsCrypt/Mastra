import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { SUPPORTED_TOKENS } from "@/lib/tokens";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Mastra AI: a real Claude-backed assistant grounded in Mastra's actual
 * architecture, so it answers truthfully about this specific product
 * instead of guessing. It has no tool access and no live chain/API data —
 * it explains how the system works, it does not report live state (use
 * /swap or /audit for that).
 */

const client = new Anthropic();

const SYSTEM_PROMPT = `You are Mastra AI, the assistant embedded in Mastra — a real, non-simulated execution control center that lets a user swap ERC-20 tokens on Ethereum mainnet.

Real, current facts about Mastra (answer from these — do not invent capabilities beyond them):
- Wayfinder is the routing layer: it quotes a real swap route across DEXs (Uniswap, Curve, Balancer have all been seen in real routes).
- Mastra decodes that route (the outer execute(bytes,bytes[]) call) and verifies the target router against a small, address-based allowlist before ever showing it to the user.
- KeeperHub is the execution layer: it holds its own non-custodial wallet and actually signs and broadcasts the transaction on Ethereum mainnet. The user's own connected browser wallet is identity/display only — it never signs the swap. Gas is sponsored by KeeperHub through a relayer/meta-transaction contract.
- Security invariant: right before executing, Mastra recomputes a hash (SHA-256 over the canonicalized target contract, network, commands, inputs, and any approval action) from what is actually stored in KeeperHub and compares it to the hash computed when the user approved. Any mismatch — anything about the workflow changing after approval — refuses execution automatically.
- Supported tokens today: ${SUPPORTED_TOKENS.map((t) => `${t.symbol} (${t.name})`).join(", ")}. All on Ethereum mainnet.
- Real swaps can and do revert on-chain sometimes — gas is spent but no funds are lost, since a revert undoes everything else. This has genuinely happened in testing, especially at very small trade sizes, where Wayfinder can pick a long, fragile multi-hop route.
- Pages: /swap (do a real swap), /audit (real history of past attempts, recorded locally in the browser), /ai (this assistant).

What you do NOT have: no live wallet balances, no live prices, no ability to look up a specific transaction or execution — you only know the architecture and how to use the product, not this moment's on-chain state. If asked something like that, say so and point to /swap or /audit.

Be concise, accurate, and honest about uncertainty. Never give financial advice (no "you should buy/sell X") — you can explain mechanics, not predict markets. Never claim a swap will definitely succeed.

Formatting: the chat UI displays your reply as plain text, not rendered markdown. Write in plain conversational prose and short paragraphs only. Do not use markdown syntax of any kind — no **bold**, no *italics*, no numbered or bulleted lists, no headers, no backticks. If you need to walk through steps, describe them in a sentence or a short paragraph instead of a list.`;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface RequestBody {
  messages?: ChatMessage[];
}

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) {
    return NextResponse.json({ ok: false, error: "messages is required and must be non-empty." }, { status: 400 });
  }

  try {
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      output_config: { effort: "low" },
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    if (!textBlock) {
      return NextResponse.json({ ok: false, error: "Mastra AI returned no text response." }, { status: 502 });
    }

    return NextResponse.json({ ok: true, reply: textBlock.text });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { ok: false, error: "Mastra AI is not configured — ANTHROPIC_API_KEY is missing or invalid." },
        { status: 502 },
      );
    }
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ ok: false, error: "Mastra AI is rate-limited right now — try again shortly." }, { status: 429 });
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json({ ok: false, error: `Mastra AI error: ${err.message}` }, { status: 502 });
    }
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error calling Mastra AI." },
      { status: 500 },
    );
  }
}
