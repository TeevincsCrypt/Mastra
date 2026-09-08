import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  buildUsdcBridgeProposal,
  fakeAddress,
  runExecution,
  runSimulation,
} from "./mock";
import type {
  ExecutionRecord,
  ExecutionStep,
  SimulationResult,
  WorkflowProposal,
} from "./types";

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

      simulation: { status: "idle", steps: [] },

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
          simulation: { status: "idle", steps: [] },
          execution: { status: "idle", steps: [] },
        });
      },

      requestProposal: () => {
        set({ proposalStatus: "incoming" });
        setTimeout(() => {
          set({
            proposal: buildUsdcBridgeProposal(),
            proposalStatus: "ready",
            simulation: { status: "idle", steps: [] },
            execution: { status: "idle", steps: [] },
          });
        }, 1100);
      },

      runKeeperSimulation: async () => {
        const proposal = get().proposal;
        if (!proposal) return;
        set({
          simulation: {
            status: "running",
            steps: proposal.actions.map((a) => ({ actionId: a.id, status: "pending", checks: [] })),
            startedAt: Date.now(),
            keeperNode: "keeper-node-07.us-east",
          },
        });

        await runSimulation(
          proposal,
          (result, idx) => {
            set((state) => {
              const steps = [...state.simulation.steps];
              steps[idx] = result;
              return { simulation: { ...state.simulation, steps } };
            });
          },
          (stepIdx, checkIdx, check) => {
            set((state) => {
              const steps = [...state.simulation.steps];
              const step = { ...steps[stepIdx], checks: [...steps[stepIdx].checks] };
              step.checks[checkIdx] = check;
              steps[stepIdx] = step;
              return { simulation: { ...state.simulation, steps } };
            });
          },
        );

        const totalGas = proposal.actions.reduce((sum, a) => sum + parseFloat(a.estimatedGas), 0);
        set((state) => ({
          simulation: {
            ...state.simulation,
            status: "passed",
            finishedAt: Date.now(),
            totalGasEstimate: `${totalGas.toFixed(5)} ETH`,
          },
        }));
      },

      approveAndExecute: async () => {
        const proposal = get().proposal;
        if (!proposal || !get().walletAddress) return;

        set({
          execution: {
            status: "running",
            steps: proposal.actions.map((a) => ({
              actionId: a.id,
              label: a.title,
              chain: a.chain,
              status: "pending",
            })),
            startedAt: Date.now(),
          },
        });

        const finalTxHash = await runExecution(proposal, (step, idx) => {
          set((state) => {
            const steps = [...state.execution.steps];
            steps[idx] = step;
            return { execution: { ...state.execution, steps } };
          });
        });

        const finishedAt = Date.now();
        set((state) => ({
          execution: { ...state.execution, status: "confirmed", finishedAt, finalTxHash },
        }));

        const record: ExecutionRecord = {
          id: `exec-${finishedAt}`,
          proposalId: proposal.id,
          intent: proposal.intent,
          status: "confirmed",
          steps: get().execution.steps,
          startedAt: get().execution.startedAt ?? finishedAt,
          finishedAt,
          finalTxHash,
          approvedBy: get().walletAddress ?? "",
          fromChain: proposal.fromChain,
          toChain: proposal.toChain,
          amount: proposal.amount,
          token: proposal.token,
          usdValue: proposal.usdValue,
          simulationPassed: get().simulation.status === "passed",
        };

        set((state) => ({ auditTrail: [record, ...state.auditTrail] }));
      },

      rejectProposal: () => {
        set({
          proposal: null,
          proposalStatus: "none",
          simulation: { status: "idle", steps: [] },
          execution: { status: "idle", steps: [] },
        });
      },

      resetActive: () => {
        set({
          proposal: null,
          proposalStatus: "none",
          simulation: { status: "idle", steps: [] },
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
