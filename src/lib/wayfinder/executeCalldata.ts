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
