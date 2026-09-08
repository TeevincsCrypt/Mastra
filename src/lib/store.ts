import { create } from "zustand";
import { persist } from "zustand/middleware";
import { buildUsdcBridgeProposal, fakeAddress } from "./mock";
import type { ExecutionRecord, ExecutionStep, SimulationResult, WorkflowProposal } from "./types";

interface KeeperHubExecuteResponse {
  ok: boolean;
  workflowId?: string;
  executionId?: string;
  status?: "completed" | "failed" | "pending";
  transactionHashes?: string[];
  error?: string;
}

interface KeeperHubPreflightResponse {
  ok: boolean;
  workflow?: { id: string; name?: string; chain?: string };
  error?: string;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface MastraState {
  walletConnected: boolean;
  walletAddress: string | null;

  proposal: WorkflowProposal | null;
  proposalStatus: "none" | "incoming" | "ready";

  simulation: SimulationResult;

  execution: {
    status: "idle" | "running" | "confirmed" | "failed";
    steps: ExecutionStep[];
    startedAt?: number;
    finishedAt?: number;
    finalTxHash?: string;
    keeperhubWorkflowId?: string;
    keeperhubExecutionId?: string;
    error?: string;
  };

  auditTrail: ExecutionRecord[];

  connectWallet: () => void;
  disconnectWallet: () => void;
  requestProposal: () => void;
  runKeeperSimulation: () => Promise<void>;
  approveAndExecute: () => Promise<void>;
  rejectProposal: () => void;
  resetActive: () => void;
}

export const useMastraStore = create<MastraState>()(
  persist(
    (set, get) => ({
      walletConnected: false,
      walletAddress: null,

      proposal: null,
      proposalStatus: "none",

      simulation: { status: "idle" },

      execution: { status: "idle", steps: [] },

      auditTrail: [],

      connectWallet: () => {
        set({ walletConnected: true, walletAddress: fakeAddress() });
        setTimeout(() => {
          if (!get().proposal) get().requestProposal();
        }, 900);
      },

      disconnectWallet: () => {
        set({
          walletConnected: false,
          walletAddress: null,
          proposal: null,
          proposalStatus: "none",
          simulation: { status: "idle" },
          execution: { status: "idle", steps: [] },
        });
      },

      requestProposal: () => {
        set({ proposalStatus: "incoming" });
        setTimeout(() => {
          set({
            proposal: buildUsdcBridgeProposal(),
            proposalStatus: "ready",
            simulation: { status: "idle" },
            execution: { status: "idle", steps: [] },
          });
        }, 1100);
      },

      // Real KeeperHub preflight: GET /api/keeperhub/preflight confirms the
      // configured workflow exists and reports what it targets. This is not
      // a transaction dry-run — KeeperHub's API doesn't expose one — so it
      // is deliberately not called "simulation" anywhere past this point.
      runKeeperSimulation: async () => {
        set({ simulation: { status: "running", startedAt: Date.now() } });

        try {
          const res = await fetch("/api/keeperhub/preflight");
          const data: KeeperHubPreflightResponse = await res.json();

          if (!res.ok || !data.ok) {
            set({
              simulation: {
                status: "failed",
                startedAt: get().simulation.startedAt,
                finishedAt: Date.now(),
                error: data.error ?? `Preflight request failed (${res.status}).`,
              },
            });
            return;
          }

          set({
            simulation: {
              status: "passed",
              startedAt: get().simulation.startedAt,
              finishedAt: Date.now(),
              workflow: data.workflow,
            },
          });
        } catch (err) {
          set({
            simulation: {
              status: "failed",
              startedAt: get().simulation.startedAt,
              finishedAt: Date.now(),
              error: err instanceof Error ? err.message : "Preflight request failed.",
            },
          });
        }
      },

      // Real KeeperHub execution: POST triggers it, then poll GET until the
      // execution reaches a terminal state. transactionHashes/executionId
      // come straight from KeeperHub's response — never fabricated here.
      approveAndExecute: async () => {
        const proposal = get().proposal;
        if (!proposal || !get().walletAddress) return;

        set({
          execution: {
            status: "running",
            steps: [
              {
                actionId: "keeperhub-execution",
                label: "Execute KeeperHub workflow",
                chain: "sepolia",
                status: "active",
                timestamp: Date.now(),
              },
            ],
            startedAt: Date.now(),
          },
        });

        try {
          let result: KeeperHubExecuteResponse = await fetch("/api/keeperhub/execute", { method: "POST" }).then((r) =>
            r.json(),
          );

          const maxPolls = 20;
          for (let i = 0; result.ok && result.status === "pending" && i < maxPolls; i++) {
            await delay(3000);
            const params = new URLSearchParams({
              workflowId: result.workflowId ?? "",
              executionId: result.executionId ?? "",
            });
            result = await fetch(`/api/keeperhub/execute?${params}`).then((r) => r.json());
          }

          const finishedAt = Date.now();

          if (!result.ok || result.status !== "completed") {
            const errorMessage =
              result.error ??
              (result.status === "pending" ? "Execution did not confirm within the polling window." : "KeeperHub execution failed.");
            set((state) => ({
              execution: {
                ...state.execution,
                status: "failed",
                finishedAt,
                error: errorMessage,
                keeperhubWorkflowId: result.workflowId,
                keeperhubExecutionId: result.executionId,
                steps: [
                  {
                    ...state.execution.steps[0],
                    status: "failed",
                    timestamp: finishedAt,
                  },
                ],
              },
            }));

            const record: ExecutionRecord = {
              id: `exec-${finishedAt}`,
              proposalId: proposal.id,
              intent: `Real KeeperHub execution failed (workflow ${result.workflowId ?? "unknown"})`,
              status: "failed",
              steps: get().execution.steps,
              startedAt: get().execution.startedAt ?? finishedAt,
              finishedAt,
              approvedBy: get().walletAddress ?? "",
              fromChain: "sepolia",
              toChain: "sepolia",
              amount: "—",
              token: "",
              usdValue: "—",
              preflightPassed: get().simulation.status === "passed",
              keeperhubWorkflowId: result.workflowId,
              keeperhubExecutionId: result.executionId,
              error: errorMessage,
            };
            set((state) => ({ auditTrail: [record, ...state.auditTrail] }));
            return;
          }

          const finalTxHash = result.transactionHashes?.[0];
          set((state) => ({
            execution: {
              ...state.execution,
              status: "confirmed",
              finishedAt,
              finalTxHash,
              keeperhubWorkflowId: result.workflowId,
              keeperhubExecutionId: result.executionId,
              steps: [
                {
                  ...state.execution.steps[0],
                  status: "confirmed",
                  txHash: finalTxHash,
                  timestamp: finishedAt,
                },
              ],
            },
          }));

          const record: ExecutionRecord = {
            id: `exec-${finishedAt}`,
            proposalId: proposal.id,
            intent: `Real KeeperHub execution — workflow ${result.workflowId} on Sepolia`,
            status: "confirmed",
            steps: get().execution.steps,
            startedAt: get().execution.startedAt ?? finishedAt,
            finishedAt,
            finalTxHash,
            approvedBy: get().walletAddress ?? "",
            fromChain: "sepolia",
            toChain: "sepolia",
            amount: "—",
            token: "",
            usdValue: "—",
            preflightPassed: get().simulation.status === "passed",
            keeperhubWorkflowId: result.workflowId,
            keeperhubExecutionId: result.executionId,
          };
          set((state) => ({ auditTrail: [record, ...state.auditTrail] }));
        } catch (err) {
          const finishedAt = Date.now();
          const errorMessage = err instanceof Error ? err.message : "Execution request failed.";
          set((state) => ({
            execution: {
              ...state.execution,
              status: "failed",
              finishedAt,
              error: errorMessage,
              steps: [{ ...state.execution.steps[0], status: "failed", timestamp: finishedAt }],
            },
          }));
        }
      },

      rejectProposal: () => {
        set({
          proposal: null,
          proposalStatus: "none",
          simulation: { status: "idle" },
          execution: { status: "idle", steps: [] },
        });
      },

      resetActive: () => {
        set({
          proposal: null,
          proposalStatus: "none",
          simulation: { status: "idle" },
          execution: { status: "idle", steps: [] },
        });
      },
    }),
    {
      name: "mastra-store",
      partialize: (state) => ({
        walletConnected: state.walletConnected,
        walletAddress: state.walletAddress,
        auditTrail: state.auditTrail,
      }),
    },
  ),
);
