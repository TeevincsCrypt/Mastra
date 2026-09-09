import "server-only";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

/**
 * Server-only MCP client for the real, unmodified WayfinderFoundation
 * wayfinder-paths-sdk MCP server (see /wayfinder-service), reached over its
 * officially-supported streamable-http transport.
 *
 * Only onchain_quote_swap is ever called — a read-only routing/quote tool.
 * onchain_swap / onchain_send (which sign and broadcast internally, per the
 * SDK's own source) are deliberately never invoked from here. Wayfinder is
 * the routing/decision layer; KeeperHub remains the sole executor.
 */

export class WayfinderError extends Error {}

function getServiceUrl(): string {
  const url = process.env.WAYFINDER_MCP_URL;
  if (!url) {
    throw new WayfinderError("WAYFINDER_MCP_URL is not set — no deployed Wayfinder MCP service configured.");
  }
  return url;
}

export interface WayfinderQuoteParams {
  fromToken: string;
  toToken: string;
  amount: string;
  slippageBps?: number;
  walletLabel?: string;
}

export interface WayfinderQuoteResult {
  raw: Record<string, unknown>;
  fromToken: string;
  toToken: string;
  amount: string;
  slippageBps?: number;
  chain?: string;
  bestQuote?: Record<string, unknown>;
  providers?: unknown;
  suggestedSwapRequest?: Record<string, unknown>;
}

interface ContentBlock {
  type?: string;
  text?: string;
}

interface ToolCallResult {
  content?: unknown;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const url = getServiceUrl();
  const transport = new StreamableHTTPClientTransport(new URL(url));
  const client = new Client({ name: "mastra", version: "1.0.0" });
  try {
    await client.connect(transport);
    return await fn(client);
  } catch (err) {
    if (err instanceof WayfinderError) throw err;
    throw new WayfinderError(
      `Failed to reach the Wayfinder MCP service at ${url}: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    try {
      await client.close();
    } catch {
      // best-effort close
    }
  }
}

export async function quoteSwap(params: WayfinderQuoteParams): Promise<WayfinderQuoteResult> {
  return withClient(async (client) => {
    const result = (await client.callTool({
      name: "onchain_quote_swap",
      arguments: {
        wallet_label: params.walletLabel ?? "mastra-quote-wallet",
        from_token: params.fromToken,
        to_token: params.toToken,
        amount: params.amount,
        slippage_bps: params.slippageBps ?? 50,
      },
    })) as ToolCallResult;

    if (result.isError) {
      throw new WayfinderError(extractText(result) ?? "onchain_quote_swap returned an error.");
    }

    const data = result.structuredContent ?? parseTextContent(result);
    if (!data) {
      throw new WayfinderError("onchain_quote_swap returned no parseable content — check the raw MCP response.");
    }

    const quote = asRecord(data.quote);
    return {
      raw: data,
      fromToken: params.fromToken,
      toToken: params.toToken,
      amount: params.amount,
      slippageBps: params.slippageBps,
      chain: typeof data.chain === "string" ? data.chain : undefined,
      bestQuote: asRecord(quote?.best_quote),
      providers: quote?.providers,
      suggestedSwapRequest: asRecord(data.suggested_swap_request),
    };
  });
}

function extractText(result: ToolCallResult): string | undefined {
  if (!Array.isArray(result.content)) return undefined;
  for (const block of result.content as ContentBlock[]) {
    if (block?.type === "text" && typeof block.text === "string") return block.text;
  }
  return undefined;
}

function parseTextContent(result: ToolCallResult): Record<string, unknown> | undefined {
  const text = extractText(result);
  if (!text) return undefined;
  try {
    const parsed: unknown = JSON.parse(text);
    return asRecord(parsed);
  } catch {
    return undefined;
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}
