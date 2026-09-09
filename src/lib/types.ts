export type ChainId = "base" | "arbitrum" | "ethereum" | "sepolia";

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

/**
 * KeeperHub's documented API does not expose a standalone dry-run/simulation
 * endpoint distinct from executing a workflow. "Preflight" here means a real
 * GET against KeeperHub confirming the configured workflow exists, is valid,
 * and targets the expected chain — genuinely real, just not a transaction
 * dry-run. See src/app/api/keeperhub/preflight/route.ts.
 */
export interface KeeperHubWorkflowSummary {
  id: string;
  name?: string;
  chain?: string;
}

export interface SimulationResult {
  status: "idle" | "running" | "passed" | "failed";
  startedAt?: number;
  finishedAt?: number;
  workflow?: KeeperHubWorkflowSummary;
  error?: string;
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
  preflightPassed: boolean;
  /** Real KeeperHub identifiers for this execution — present once real
   * integration has run; absent for anything not backed by a live call. */
  keeperhubWorkflowId?: string;
  keeperhubExecutionId?: string;
  /** SHA-256 of the canonicalized approved proposal, computed at approval
   * time and reverified immediately before execution — see approvalHash.ts. */
  approvedWorkflowHash?: string;
  error?: string;
}
