import type {
  ChainId,
  ChainMeta,
  ExecutionStep,
  SimulationCheck,
  SimulationStepResult,
  WorkflowAction,
  WorkflowProposal,
} from "./types";

export const CHAINS: Record<ChainId, ChainMeta> = {
  base: { id: "base", name: "Base", color: "#0052FF", glow: "rgba(0,82,255,0.35)" },
  arbitrum: { id: "arbitrum", name: "Arbitrum", color: "#28A0F0", glow: "rgba(40,160,240,0.35)" },
  ethereum: { id: "ethereum", name: "Ethereum", color: "#8C8C8C", glow: "rgba(140,140,140,0.35)" },
};

function hex(len: number) {
  const chars = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * 16)];
  return out;
}

export function fakeAddress() {
  return `0x${hex(40)}`;
}

export function fakeTxHash() {
  return `0x${hex(64)}`;
}

export function shortHash(hash: string, lead = 6, tail = 4) {
  if (!hash) return "";
  return `${hash.slice(0, lead + 2)}…${hash.slice(-tail)}`;
}

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const USDC_ARBITRUM = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const BRIDGE_ROUTER = "0x4200000000000000000000000000000000006A";

export function buildUsdcBridgeProposal(): WorkflowProposal {
  const now = Date.now();
  const actions: WorkflowAction[] = [
    {
      id: "act-approve",
      order: 1,
      type: "approve",
      title: "Approve USDC spend",
      description: "Grant the KeeperHub bridge router allowance to move 500 USDC from your wallet on Base.",
      chain: "base",
      contract: { address: USDC_BASE, name: "USDC (Base)", verified: true },
      token: { symbol: "USDC", amount: "500.00" },
      estimatedGas: "0.00021 ETH",
    },
    {
      id: "act-bridge",
      order: 2,
      type: "bridge",
      title: "Bridge USDC to Arbitrum",
      description: "Lock 500 USDC on Base and initiate a canonical bridge transfer to Arbitrum via the KeeperHub-verified router.",
      chain: "base",
      contract: { address: BRIDGE_ROUTER, name: "KeeperHub Bridge Router", verified: true },
      token: { symbol: "USDC", amount: "500.00" },
      estimatedGas: "0.00084 ETH",
    },
    {
      id: "act-confirm",
      order: 3,
      type: "confirm",
      title: "Receive USDC on Arbitrum",
      description: "Finalize the transfer and credit 500 USDC to your wallet on Arbitrum.",
      chain: "arbitrum",
      contract: { address: USDC_ARBITRUM, name: "USDC (Arbitrum)", verified: true },
      token: { symbol: "USDC", amount: "500.00" },
      estimatedGas: "0.00006 ETH",
    },
  ];

  return {
    id: `prop-${now}`,
    agent: "Wayfinder",
    intent: "Move 500 USDC from Base to Arbitrum",
    createdAt: now,
    actions,
    fromChain: "base",
    toChain: "arbitrum",
    token: "USDC",
    amount: "500.00",
    usdValue: "500.00",
  };
}

const CHECKS_BY_TYPE: Record<WorkflowAction["type"], string[]> = {
  approve: ["Spender contract verified", "Allowance amount matches proposal", "Wallet balance sufficient"],
  bridge: ["Route matches Wayfinder proposal exactly", "Bridge contract bytecode verified", "Slippage within bounds", "No unexpected calldata"],
  confirm: ["Destination address matches connected wallet", "Expected receive amount matches proposal"],
};

export async function runSimulation(
  proposal: WorkflowProposal,
  onStep: (result: SimulationStepResult, stepIndex: number) => void,
  onCheck: (stepIndex: number, checkIndex: number, check: SimulationCheck) => void,
): Promise<void> {
  for (let i = 0; i < proposal.actions.length; i++) {
    const action = proposal.actions[i];
    const checks: SimulationCheck[] = CHECKS_BY_TYPE[action.type].map((label) => ({
      label,
      status: "pending",
    }));
    onStep({ actionId: action.id, status: "running", checks: [...checks] }, i);

    for (let c = 0; c < checks.length; c++) {
      await delay(220 + Math.random() * 180);
      checks[c] = { ...checks[c], status: "passed" };
      onCheck(i, c, checks[c]);
    }

    await delay(150);
    onStep(
      {
        actionId: action.id,
        status: "passed",
        checks,
        gasUsed: action.estimatedGas,
      },
      i,
    );
  }
}

export async function runExecution(
  proposal: WorkflowProposal,
  onStep: (step: ExecutionStep, stepIndex: number) => void,
): Promise<string> {
  let finalHash = "";
  for (let i = 0; i < proposal.actions.length; i++) {
    const action = proposal.actions[i];
    onStep(
      { actionId: action.id, label: action.title, chain: action.chain, status: "active", timestamp: Date.now() },
      i,
    );
    await delay(650 + Math.random() * 500);
    const txHash = fakeTxHash();
    if (i === proposal.actions.length - 1) finalHash = txHash;
    onStep(
      {
        actionId: action.id,
        label: action.title,
        chain: action.chain,
        status: "confirmed",
        txHash,
        timestamp: Date.now(),
      },
      i,
    );
  }
  return finalHash;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
