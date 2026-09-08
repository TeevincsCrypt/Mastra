export type ChainId = "base" | "arbitrum" | "ethereum";

export interface ChainMeta {
  id: ChainId;
  name: string;
  color: string;
  glow: string;
}

export interface WorkflowAction {
  id: string;
  order: number;
  type: "approve" | "bridge" | "confirm";
  title: string;
  description: string;
  chain: ChainId;
  contract: { address: string; name: string; verified: boolean };
  token: { symbol: string; amount: string };
  estimatedGas: string;
}

export interface WorkflowProposal {
  id: string;
  agent: "Wayfinder";
  intent: string;
  createdAt: number;
  actions: WorkflowAction[];
  fromChain: ChainId;
  toChain: ChainId;
  token: string;
  amount: string;
  usdValue: string;
}

export type SimStepStatus = "pending" | "running" | "passed" | "failed";

export interface SimulationCheck {
  label: string;
  status: SimStepStatus;
}

export interface SimulationStepResult {
  actionId: string;
  status: SimStepStatus;
  checks: SimulationCheck[];
  gasUsed?: string;
}

export interface SimulationResult {
  status: "idle" | "running" | "passed" | "failed";
  steps: SimulationStepResult[];
  startedAt?: number;
  finishedAt?: number;
  totalGasEstimate?: string;
  keeperNode?: string;
}

export type ExecStepStatus = "pending" | "active" | "confirmed" | "failed";

export interface ExecutionStep {
  actionId: string;
  label: string;
  chain: ChainId;
  status: ExecStepStatus;
  txHash?: string;
  timestamp?: number;
}

export type ExecutionStatus = "running" | "confirmed" | "failed";

export interface ExecutionRecord {
  id: string;
  proposalId: string;
  intent: string;
  status: ExecutionStatus;
  steps: ExecutionStep[];
  startedAt: number;
  finishedAt?: number;
  finalTxHash?: string;
  approvedBy: string;
  fromChain: ChainId;
  toChain: ChainId;
  amount: string;
  token: string;
  usdValue: string;
  simulationPassed: boolean;
}
