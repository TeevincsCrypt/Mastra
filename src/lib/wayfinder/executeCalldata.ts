import { decodeFunctionData, type Hex } from "viem";

/**
 * Decodes the outer call of a Universal-Router-style `execute(bytes,bytes[])`
 * transaction. This is deliberately the ONLY decoding this project does of
 * Wayfinder-produced swap calldata for execution purposes — the inner
 * `commands`/`inputs[]` values are extracted as opaque bytes and passed
 * through unchanged. This project does not reconstruct, reinterpret, or
 * rebuild the swap route; the Wayfinder-produced bytes remain authoritative.
 *
 * The `execute(bytes,bytes[])` ABI itself was independently verified
 * (selector match against a real captured Wayfinder execution_quote) —
 * see project history. Per-command semantics (V3_SWAP_EXACT_IN,
 * CURVE_SWAP_EXACT_IN, etc.) are NOT decoded here and are not needed to
 * relay the call through KeeperHub's ABI-based write-contract action.
 */

export const EXECUTE_ABI = [
  {
    type: "function",
    name: "execute",
    inputs: [
      { name: "commands", type: "bytes" },
      { name: "inputs", type: "bytes[]" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
] as const;

export class ExecuteCalldataError extends Error {}

export interface DecodedExecuteCall {
  commands: Hex;
  inputs: Hex[];
}

/**
 * The ONLY router contract this project has actually verified: its source
 * was independently confirmed (execute(bytes,bytes[]) signature, Commands
 * library with real byte values, decoded and cross-checked against a real
 * captured Wayfinder swap — see project history). Wayfinder can route a
 * quote through other providers (LI.FI, Enso, or Sprinter via a different
 * internal path) whose contracts have NOT been verified — their calldata
 * may coincidentally match this same execute(bytes,bytes[]) signature
 * while having entirely different, unaudited semantics. Matching the
 * ABI shape is not sufficient trust; matching this exact address is.
 */
export const VERIFIED_ROUTER_ADDRESS = "0xEbE0FA42523F69Ea1E97F5B08282654c19c2c0Ee";

export function isVerifiedRouter(address: string): boolean {
  return address.toLowerCase() === VERIFIED_ROUTER_ADDRESS.toLowerCase();
}

export function decodeExecuteCalldata(data: Hex): DecodedExecuteCall {
  let decoded;
  try {
    decoded = decodeFunctionData({ abi: EXECUTE_ABI, data });
  } catch (err) {
    throw new ExecuteCalldataError(
      `Calldata does not match execute(bytes,bytes[]) — cannot decode: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (decoded.functionName !== "execute") {
    throw new ExecuteCalldataError(`Expected function "execute", decoded "${decoded.functionName}" instead.`);
  }
  const [commands, inputs] = decoded.args;
  return { commands, inputs: [...inputs] };
}
