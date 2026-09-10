import { NextResponse } from "next/server";
import type { Hash, Hex } from "viem";
import { getTransactionForensics } from "@/lib/onchain/forensics";
import { getErc20Allowance, getErc20Balance } from "@/lib/onchain/allowance";
import { decodeExecuteCalldata, ExecuteCalldataError, VERIFIED_ROUTER_ADDRESS } from "@/lib/wayfinder/executeCalldata";
import { getCreatedWorkflow } from "@/lib/keeperhub/dynamicWorkflow";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Read-only forensic analysis of an already-mined transaction. Every call
 * here is a GET/eth_call/eth_getTransaction* read — no execute, no enable,
 * no create, no signing, no broadcast anywhere in this route.
 */

const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const EXECUTION_WALLET = "0x1d70c72949a7bce179e6d789c8b36940c2f4b599";

interface RequestBody {
  txHash?: string;
  workflowId?: string;
}

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.txHash) {
    return NextResponse.json({ ok: false, error: "txHash is required." }, { status: 400 });
  }

  const result: Record<string, unknown> = {};

  let forensics;
  try {
    forensics = await getTransactionForensics(body.txHash as Hash);
    result.forensics = forensics;
  } catch (err) {
    return NextResponse.json(
      { ok: false, stage: "fetch_transaction", error: err instanceof Error ? err.message : "Unknown error." },
      { status: 502 },
    );
  }

  const tx = forensics.transaction as Record<string, unknown>;

  const outerDecode: Record<string, unknown> = {};
  try {
    const decoded = decodeExecuteCalldata(tx.input as Hex);
    outerDecode.isExecuteBytesBytes = true;
    outerDecode.commands = decoded.commands;
    outerDecode.inputs = decoded.inputs;
    outerDecode.commandCount = (decoded.commands.length - 2) / 2;
    outerDecode.inputsCount = decoded.inputs.length;
  } catch (err) {
    outerDecode.isExecuteBytesBytes = false;
    outerDecode.error = err instanceof ExecuteCalldataError ? err.message : err instanceof Error ? err.message : "Unknown error.";
  }
  result.outerDecode = outerDecode;
  result.reachedVerifiedRouter = typeof tx.to === "string" && tx.to.toLowerCase() === VERIFIED_ROUTER_ADDRESS.toLowerCase();
  result.actualTo = tx.to;
  result.verifiedRouterAddress = VERIFIED_ROUTER_ADDRESS;

  if (body.workflowId) {
    try {
      const workflow = await getCreatedWorkflow(body.workflowId);
      const record = workflow && typeof workflow === "object" ? (workflow as Record<string, unknown>) : {};
      const nodes = Array.isArray(record.nodes) ? (record.nodes as Array<Record<string, unknown>>) : [];
      const executeNode = nodes.find((n) => {
        const data = n.data as Record<string, unknown> | undefined;
        const config = data?.config as Record<string, unknown> | undefined;
        return config?.abiFunction === "execute";
      });
      const executeConfig = (executeNode?.data as Record<string, unknown> | undefined)?.config as
        | Record<string, unknown>
        | undefined;

      if (executeConfig && typeof executeConfig.functionArgs === "string") {
        const [storedCommands, storedInputs] = JSON.parse(executeConfig.functionArgs) as [string, string[]];
        result.persistedWorkflow = {
          workflowId: body.workflowId,
          contractAddress: executeConfig.contractAddress,
          commands: storedCommands,
          inputs: storedInputs,
        };
        result.byteForByteComparison = {
          commandsMatch: outerDecode.commands === storedCommands,
          inputsMatch:
            Array.isArray(outerDecode.inputs) &&
            JSON.stringify(outerDecode.inputs) === JSON.stringify(storedInputs),
          contractAddressMatch:
            typeof executeConfig.contractAddress === "string" &&
            typeof tx.to === "string" &&
            executeConfig.contractAddress.toLowerCase() === tx.to.toLowerCase(),
        };
      } else {
        result.persistedWorkflow = { error: "No execute action found in stored workflow, or functionArgs missing." };
      }
    } catch (err) {
      result.persistedWorkflowError = err instanceof Error ? err.message : "Unknown error fetching workflow.";
    }
  }

  try {
    const [usdcBalance, usdcAllowance, wethBalance] = await Promise.all([
      getErc20Balance(USDC_ADDRESS, EXECUTION_WALLET),
      getErc20Allowance(USDC_ADDRESS, EXECUTION_WALLET, VERIFIED_ROUTER_ADDRESS),
      getErc20Balance(WETH_ADDRESS, EXECUTION_WALLET),
    ]);
    result.currentState = {
      executionWallet: EXECUTION_WALLET,
      usdcBalance: usdcBalance.toString(),
      usdcAllowanceToRouter: usdcAllowance.toString(),
      wethBalance: wethBalance.toString(),
    };
  } catch (err) {
    result.currentStateError = err instanceof Error ? err.message : "Unknown error reading current balances.";
  }

  return NextResponse.json({ ok: true, ...result });
}
