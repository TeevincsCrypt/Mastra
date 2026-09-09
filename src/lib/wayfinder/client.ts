import "server-only";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

/**
 * Server-only MCP client for the real, unmodified WayfinderFoundation
 * wayfinder-paths-sdk MCP server (see /wayfinder-service), reached over its
 * officially-supported streamable-http transport.
 *
 * Only two read-only tools are ever called: onchain_quote_swap and
 * onchain_resolve_token (used purely as a token-lookup diagnostic — see
 * resolveToken() below). onchain_swap / onchain_send (which sign and
 * broadcast internally, per the SDK's own source) are deliberately never
 * invoked from here. Wayfinder is the routing/decision layer; KeeperHub
 * remains the sole executor.
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
        // Requests the real swap calldata alongside the quote — needed to
        // determine whether KeeperHub's workflow schema can execute it.
        // Still never signs or broadcasts anything; onchain_quote_swap
        // remains a read-only routing/quote call.
        include_calldata: true,
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

/**
 * Diagnostic only: calls the SDK's read-only onchain_resolve_token tool
 * directly. Unlike onchain_quote_swap — which swallows the underlying HTTP
 * error from Wayfinder's token-detail endpoint into a bare "Cannot resolve
 * token" string with no status code — this tool's own error handling
 * preserves { status_code } in its `details`. Useful for diagnosing token
 * resolution failures without guessing, and without patching the vendored
 * SDK. Never signs or broadcasts anything.
 */
export async function resolveToken(query: string): Promise<{ raw: Record<string, unknown> }> {
  return withClient(async (client) => {
    const result = (await client.callTool({
      name: "onchain_resolve_token",
      arguments: { query },
    })) as ToolCallResult;

    if (result.isError) {
      throw new WayfinderError(extractText(result) ?? "onchain_resolve_token returned an error.");
    }

    const data = result.structuredContent ?? parseTextContent(result);
    if (!data) {
      throw new WayfinderError("onchain_resolve_token returned no parseable content — check the raw MCP response.");
    }

    return { raw: data };
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
