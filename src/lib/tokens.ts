/**
 * Curated list of mainnet tokens Mastra's real swap pipeline supports.
 *
 * Deliberately short: every address here was confirmed against real,
 * on-chain data during this project's own forensic work (transaction logs,
 * decoded calldata) — not trusted from memory alone, since a wrong address
 * here would misdirect a real balance check or a real swap. Add a token
 * only after independently verifying its real mainnet contract address
 * (e.g. on Etherscan), never by assumption.
 */

export interface TokenInfo {
  /** Wayfinder's canonical token id, e.g. passed as from_token/to_token to onchain_quote_swap. */
  wayfinderId: string;
  symbol: string;
  name: string;
  address: string;
  decimals: number;
}

export const USDC: TokenInfo = {
  wayfinderId: "usd-coin-ethereum",
  symbol: "USDC",
  name: "USD Coin",
  address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  decimals: 6,
};

export const WETH: TokenInfo = {
  wayfinderId: "weth-ethereum",
  symbol: "WETH",
  name: "Wrapped Ether",
  address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  decimals: 18,
};

// DAI's contract address below is confirmed from real on-chain transaction
// logs this project decoded directly. Its wayfinderId, unlike USDC's and
// WETH's, is inferred from the same naming pattern rather than independently
// confirmed via a real onchain_quote_swap call — if it's wrong, quoteSwap
// will return a real, honest WayfinderError (never a silent wrong action),
// since nothing executes without a real successful quote passing first.
export const DAI: TokenInfo = {
  wayfinderId: "dai-ethereum",
  symbol: "DAI",
  name: "Dai Stablecoin",
  address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  decimals: 18,
};

export const SUPPORTED_TOKENS: TokenInfo[] = [USDC, WETH, DAI];

export function findToken(symbol: string): TokenInfo | undefined {
  return SUPPORTED_TOKENS.find((t) => t.symbol === symbol);
}
