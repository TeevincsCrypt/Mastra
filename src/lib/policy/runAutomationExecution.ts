import "server-only";
import { prepareMainnetSwapWorkflow, executeMainnetSwapWorkflow, type SwapPolicyCheckInput } from "@/lib/keeperhub/dynamicSwap";
import { evaluatePolicy } from "./evaluate";
import { getSystemState } from "@/lib/store/systemState";
import { getAutomation, updateAutomation } from "@/lib/store/automations";
import { getPolicy } from "@/lib/store/policies";
import { createExecution, updateExecution, sumSpentSince } from "@/lib/store/executions";
import { recordAuditEvent } from "@/lib/store/audit";
import type { ExecutionRecord, PolicyDecision } from "@/lib/store/types";

/**
 * The real orchestration for one automation run: system-pause gate ->
 * real Wayfinder quote (via prepareMainnetSwapWorkflow) -> deterministic
 * policy evaluation (injected as the policyCheck hook, so KeeperHub's
 * createWorkflow is provably never called on a blocked decision) -> real
 * KeeperHub workflow creation + execution on approval. Every stage is
 * written to the audit trail as it happens, not reconstructed afterward.
 */

function startOfDay(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfMonth(now: number): number {
  const d = new Date(now);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export async function runAutomationExecution(automationId: string, callerAddress: string): Promise<ExecutionRecord> {
  const automation = await getAutomation(automationId);
  if (!automation) {
    throw new Error(`Automation ${automationId} not found.`);
  }
  const policy = await getPolicy(automation.policyId);
  if (!policy) {
    throw new Error(`Automation ${automationId} has no policy — refusing to execute.`);
  }

  const now = Date.now();
  const execution = await createExecution({
    automationId,
    status: "preparing",
    requestedAmount: automation.amount,
    fromToken: automation.fromToken,
    toToken: automation.toToken,
    policyDecision: { approved: false, checks: [], evaluatedAt: now },
    keeperhubExecuteCalled: false,
  });

  await recordAuditEvent({
    automationId,
    executionId: execution.id,
    type: "TRIGGER_RECEIVED",
    message: `Execution triggered by ${callerAddress} for ${automation.amount} ${automation.fromToken} -> ${automation.toToken}.`,
  });

  const system = await getSystemState();
  if (system.paused) {
    await recordAuditEvent({
      automationId,
      executionId: execution.id,
      type: "BLOCKED_SYSTEM_PAUSED",
      message: "All automations are paused system-wide. KeeperHub was not called.",
    });
    return (await updateExecution(execution.id, {
      status: "blocked",
      error: "All automations are paused (emergency stop is active).",
      errorStage: "system_paused",
      completedAt: Date.now(),
    }))!;
  }

  await recordAuditEvent({ automationId, executionId: execution.id, type: "WAYFINDER_QUOTE_REQUESTED", message: "Requesting a real Wayfinder quote." });

  let capturedPolicyDecision: PolicyDecision | undefined;

  const policyCheck = async (input: SwapPolicyCheckInput) => {
    await recordAuditEvent({
      automationId,
      executionId: execution.id,
      type: "QUOTE_RECEIVED",
      message: `Real route found via router ${input.routerAddress}.`,
      metadata: { routerAddress: input.routerAddress, commands: input.commands },
    });
    await recordAuditEvent({ automationId, executionId: execution.id, type: "POLICY_EVALUATION", message: "Running deterministic policy check." });

    const decision = evaluatePolicy({
      policy,
      chainId: input.network,
      fromToken: automation.fromToken,
      toToken: automation.toToken,
      amount: automation.amount,
      routerAddress: input.routerAddress,
      slippageBps: input.slippageBps,
      quoteFetchedAt: input.quoteFetchedAt,
      spentTodayAmount: await sumSpentSince([automationId], startOfDay(now)),
      spentThisMonthAmount: await sumSpentSince([automationId], startOfMonth(now)),
    });
    capturedPolicyDecision = decision;

    await recordAuditEvent({
      automationId,
      executionId: execution.id,
      type: decision.approved ? "POLICY_APPROVED" : "POLICY_BLOCKED",
      message: decision.approved ? "Policy approved this execution." : `Policy blocked this execution: ${decision.reason}`,
      metadata: { checks: decision.checks },
    });

    return { blocked: !decision.approved, decision };
  };

  const prepared = await prepareMainnetSwapWorkflow(
    { fromToken: automation.fromToken, toToken: automation.toToken, amount: automation.amount },
    policyCheck,
  );

  if (!prepared.ok) {
    const blocked = Boolean(prepared.policyBlocked);
    if (!blocked && prepared.attemptsLog?.length) {
      // Not a policy block — a route-trust failure (e.g. unsupported_router).
      // The router addresses Wayfinder actually offered and why each was
      // rejected exist in prepared.attemptsLog but weren't persisted
      // anywhere: surface them here so this is inspectable in the real
      // audit trail instead of only the generic top-level error string.
      await recordAuditEvent({
        automationId,
        executionId: execution.id,
        type: "WAYFINDER_ROUTE_REJECTED",
        message: `Stage "${prepared.stage}": ${prepared.error}`,
        metadata: { attemptsLog: prepared.attemptsLog },
      });
    }
    return (await updateExecution(execution.id, {
      status: blocked ? "blocked" : "failed",
      error: prepared.error,
      errorStage: prepared.stage,
      policyDecision: capturedPolicyDecision ?? { approved: false, checks: [], reason: prepared.error, evaluatedAt: Date.now() },
      completedAt: Date.now(),
    }))!;
  }

  await recordAuditEvent({
    automationId,
    executionId: execution.id,
    type: "KEEPERHUB_PREFLIGHT",
    message: `Real KeeperHub workflow created: ${prepared.keeperhubWorkflowId}.`,
    metadata: { keeperhubWorkflowId: prepared.keeperhubWorkflowId },
  });
  await recordAuditEvent({
    automationId,
    executionId: execution.id,
    type: "APPROVAL_VERIFIED",
    message: "Approval hash computed and will be re-verified immediately before execution.",
  });

  await updateExecution(execution.id, {
    status: "executing",
    policyDecision: capturedPolicyDecision!,
    keeperhubWorkflowId: prepared.keeperhubWorkflowId,
    keeperhubExecuteCalled: true,
  });
  await recordAuditEvent({ automationId, executionId: execution.id, type: "KEEPERHUB_EXECUTION_STARTED", message: "Calling KeeperHub's real execute() endpoint." });

  const executed = await executeMainnetSwapWorkflow({
    workflowId: prepared.keeperhubWorkflowId!,
    approvedHash: prepared.approvalHash,
  });

  if (!executed.ok) {
    await recordAuditEvent({ automationId, executionId: execution.id, type: "EXECUTION_FAILED", message: executed.error, metadata: { stage: executed.stage } });
    return (await updateExecution(execution.id, {
      status: "failed",
      error: executed.error,
      errorStage: executed.stage,
      completedAt: Date.now(),
    }))!;
  }

  const succeeded = executed.status === "success";
  await recordAuditEvent({
    automationId,
    executionId: execution.id,
    type: succeeded ? "TRANSACTION_CONFIRMED" : "TRANSACTION_REVERTED",
    message: succeeded
      ? `Transaction confirmed: ${executed.transactionHashes?.[0] ?? "(no hash returned)"}`
      : `KeeperHub reported status "${executed.status}" — the swap did not succeed on-chain.`,
    metadata: { txHash: executed.transactionHashes?.[0], keeperhubExecutionId: executed.executionId },
  });

  const final = (await updateExecution(execution.id, {
    status: succeeded ? "success" : "reverted",
    keeperhubExecutionId: executed.executionId,
    txHash: executed.transactionHashes?.[0],
    chainId: "1",
    completedAt: Date.now(),
  }))!;

  await updateAutomation(automationId, {
    lastExecutionAt: Date.now(),
    lastExecutionStatus: final.status,
    status: succeeded ? "completed" : "failed",
  });

  await recordAuditEvent({ automationId, executionId: execution.id, type: "EXECUTION_COMPLETE", message: `Execution finished with status: ${final.status}.` });

  return final;
}
