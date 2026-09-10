/**
 * Core data model for Mastra's autonomous finance control plane.
 *
 * Amounts are kept in each token's own native units (human-readable
 * decimal strings, e.g. "1.2" USDC) rather than converted to USD — this
 * project has no reliable live USD price feed, and fabricating one would
 * violate the "no fake data" rule. Anywhere a dollar figure is shown in
 * the UI, it must be clearly labeled as an estimate derived from a real
 * quote, never treated as authoritative.
 */

export type AutomationType = "eth-dca" | "gas-guardian" | "take-profit" | "treasury-rebalancer" | "custom";

export type AutomationStatus =
  | "draft"
  | "policy_review"
  | "approved"
  | "deployed"
  | "active"
  | "executing"
  | "completed"
  | "blocked"
  | "failed"
  | "paused";

export interface Automation {
  id: string;
  /** The connected wallet address that created this automation — a scoping identifier, never used to sign anything. See lib/policy/auth.ts for what this does and does not guarantee. */
  ownerAddress: string;
  name: string;
  description: string;
  type: AutomationType;
  status: AutomationStatus;
  fromToken: string;
  toToken: string;
  /** Human-readable amount in fromToken's own units, e.g. "1.2". */
  amount: string;
  frequency: "one-time" | "weekly" | "daily" | "manual";
  /** Free-text note on the trigger mechanism actually driving this automation — see policy/triggers.ts for what's real vs. configured-only. */
  triggerDescription: string;
  triggerLive: boolean;
  policyId: string;
  createdAt: number;
  updatedAt: number;
  lastExecutionAt?: number;
  lastExecutionStatus?: ExecutionStatus;
}

export interface Policy {
  id: string;
  automationId: string;
  /** Max size of a single execution, in fromToken's own units. */
  maxExecutionAmount: string;
  dailyLimitAmount: string;
  monthlyLimitAmount: string;
  /** Chain ids as strings, e.g. "1" for Ethereum mainnet. */
  allowedChains: string[];
  allowedInputTokens: string[];
  allowedOutputTokens: string[];
  maxSlippageBps: number;
  /** Router addresses this policy will allow Wayfinder to route through. Defaults to the one independently verified router — see wayfinder/executeCalldata.ts. */
  allowedRouters: string[];
  requireFreshQuote: boolean;
  quoteExpirySeconds: number;
  requirePreflight: boolean;
  requireApprovalHash: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface PolicyCheckItem {
  key: string;
  label: string;
  passed: boolean;
  detail?: string;
}

export interface PolicyDecision {
  approved: boolean;
  checks: PolicyCheckItem[];
  /** Set only when approved === false — the single primary blocking reason, for a clean UI headline. */
  reason?: string;
  evaluatedAt: number;
}

export type ExecutionStatus = "blocked" | "preparing" | "executing" | "success" | "failed" | "reverted";

export interface ExecutionRecord {
  id: string;
  automationId: string;
  status: ExecutionStatus;
  requestedAmount: string;
  fromToken: string;
  toToken: string;
  policyDecision: PolicyDecision;
  keeperhubWorkflowId?: string;
  keeperhubExecutionId?: string;
  txHash?: string;
  chainId?: string;
  gasUsed?: string;
  approvalHash?: string;
  /** Set to true only once a KeeperHub execute() call was actually made — the line between "blocked" (KeeperHub never touched) and everything after it. */
  keeperhubExecuteCalled: boolean;
  error?: string;
  errorStage?: string;
  createdAt: number;
  completedAt?: number;
}

export interface AuditEvent {
  id: string;
  automationId?: string;
  executionId?: string;
  timestamp: number;
  type: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface SystemState {
  /** Server-side, authoritative emergency stop. When true, POST /api/automations/[id]/execute refuses every request before Wayfinder or KeeperHub are ever called. */
  paused: boolean;
  pausedAt?: number;
  pausedBy?: string;
}
