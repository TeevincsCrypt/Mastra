import "server-only";
import { KeeperHubError } from "./client";

/**
 * KeeperHub calls for DYNAMIC (Wayfinder-derived) workflow creation —
 * kept entirely separate from client.ts's fixed-Sepolia-workflow path so
 * that verified path is never touched. Duplicates a minimal fetch helper
 * rather than importing one from client.ts, so client.ts's diff stays
 * empty for this work.
 *
 * POST /api/workflows/create's exact schema is NOT independently confirmed
 * against live docs — this is the real, first empirical test of it. Every
 * function here reports the raw KeeperHub response on failure rather than
 * assuming success.
 */

const KEEPERHUB_BASE_URL = "https://app.keeperhub.com";

function getApiKey(): string {
  const key = process.env.KEEPERHUB_API_KEY;
  if (!key) {
    throw new KeeperHubError("KEEPERHUB_API_KEY is not set in this environment's server-side config.", 0);
  }
  return key;
}

async function keeperFetch(path: string, init?: RequestInit): Promise<unknown> {
  const key = getApiKey();
  let res: Response;
  try {
    res = await fetch(`${KEEPERHUB_BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch (err) {
    throw new KeeperHubError(
      `Network error reaching KeeperHub (${init?.method ?? "GET"} ${path}): ${err instanceof Error ? err.message : String(err)}`,
      0,
    );
  }

  const text = await res.text();
  let body: unknown = undefined;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    throw new KeeperHubError(`KeeperHub ${init?.method ?? "GET"} ${path} responded ${res.status}`, res.status, body);
  }

  return body;
}

export interface Web3WriteContractAction {
  actionType: "web3/write-contract";
  contractAddress: string;
  abi: unknown[];
  abiFunction: string;
  functionArgs: unknown[];
  network: string;
  value?: string;
}

const ERC20_APPROVE_ABI: unknown[] = [
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
];

const EXECUTE_ABI: unknown[] = [
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
];

export function buildApproveAction(params: {
  tokenAddress: string;
  spender: string;
  amount: string;
  network: string;
}): Web3WriteContractAction {
  return {
    actionType: "web3/write-contract",
    contractAddress: params.tokenAddress,
    abi: ERC20_APPROVE_ABI,
    abiFunction: "approve",
    functionArgs: [params.spender, params.amount],
    network: params.network,
  };
}

export function buildExecuteAction(params: {
  routerAddress: string;
  commands: string;
  inputs: string[];
  network: string;
  value: string;
}): Web3WriteContractAction {
  return {
    actionType: "web3/write-contract",
    contractAddress: params.routerAddress,
    abi: EXECUTE_ABI,
    abiFunction: "execute",
    functionArgs: [params.commands, params.inputs],
    network: params.network,
    value: params.value,
  };
}

export interface DynamicWorkflowDefinition {
  name: string;
  nodes: unknown[];
  edges: unknown[];
}

/**
 * Builds a {name, nodes, edges} workflow with a manual trigger followed by
 * the given actions in sequence. This shape is the one previously
 * researched from KeeperHub's documented workflow-creation schema, but
 * NOT yet live-tested — createWorkflow() below is that live test.
 */
export function buildSequentialWorkflow(name: string, actions: Web3WriteContractAction[]): DynamicWorkflowDefinition {
  const triggerId = "trigger-1";
  const actionIds = actions.map((_, i) => `action-${i + 1}`);

  const nodes: unknown[] = [
    {
      id: triggerId,
      type: "trigger",
      data: { type: "trigger", config: { triggerType: "Manual" } },
    },
    ...actions.map((action, i) => ({
      id: actionIds[i],
      type: "action",
      data: { type: "action", config: action },
    })),
  ];

  const edges: unknown[] = [];
  let prev = triggerId;
  for (const id of actionIds) {
    edges.push({ id: `edge-${prev}-${id}`, source: prev, target: id, type: "default" });
    prev = id;
  }

  return { name, nodes, edges };
}

/**
 * POST /api/workflows/create — the FIRST live test of this endpoint in this
 * project. This creates a workflow object; it does NOT execute it. No funds
 * move, nothing is signed, nothing is broadcast. A successful response
 * confirms KeeperHub accepted this schema (bytes/bytes[] functionArgs,
 * payable execute() with value); a validation error tells us exactly what's
 * rejected instead of us guessing.
 */
export async function createWorkflow(definition: DynamicWorkflowDefinition): Promise<unknown> {
  return keeperFetch("/api/workflows/create", {
    method: "POST",
    body: JSON.stringify(definition),
  });
}

/** GET /api/workflows/{id} — reused here only to inspect what was actually stored after creation, e.g. to confirm functionArgs round-tripped correctly. */
export async function getCreatedWorkflow(workflowId: string): Promise<unknown> {
  return keeperFetch(`/api/workflows/${encodeURIComponent(workflowId)}`);
}
