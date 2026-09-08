import { NextResponse } from "next/server";
import {
  executeWorkflow,
  findExecution,
  isTerminalFailure,
  isTerminalSuccess,
  KeeperHubError,
} from "@/lib/keeperhub/client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface ExecutionResultPayload {
  ok: boolean;
  workflowId?: string;
  executionId?: string;
  status?: "completed" | "failed" | "pending";
  transactionHashes?: string[];
  keeperhubStatus?: string;
  error?: string;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollOnce(workflowId: string, executionId: string): Promise<ExecutionResultPayload> {
  const execution = await findExecution(workflowId, executionId);
  if (!execution) {
    return { ok: true, workflowId, executionId, status: "pending" };
  }
  if (isTerminalSuccess(execution.status)) {
    return {
      ok: true,
      workflowId,
      executionId,
      status: "completed",
      transactionHashes: execution.transactionHashes,
      keeperhubStatus: execution.status,
    };
  }
  if (isTerminalFailure(execution.status)) {
    return {
      ok: true,
      workflowId,
      executionId,
      status: "failed",
      keeperhubStatus: execution.status,
      error: `KeeperHub reported execution status "${execution.status}".`,
    };
  }
  return { ok: true, workflowId, executionId, status: "pending", keeperhubStatus: execution.status };
}

function errorResponse(err: unknown) {
  if (err instanceof KeeperHubError) {
    return NextResponse.json(
      { ok: false, error: err.message, keeperhubStatus: err.status, keeperhubBody: err.body },
      { status: 502 },
    );
  }
  return NextResponse.json(
    { ok: false, error: err instanceof Error ? err.message : "Unknown KeeperHub execution error." },
    { status: 500 },
  );
}

/** Trigger a real execution, then poll inline for up to ~20s before handing back "pending" for the client to keep checking via GET. */
export async function POST() {
  const workflowId = process.env.KEEPERHUB_WORKFLOW_ID;
  if (!workflowId) {
    return NextResponse.json(
      { ok: false, error: "KEEPERHUB_WORKFLOW_ID is not configured on the server." },
      { status: 500 },
    );
  }

  try {
    const { executionId } = await executeWorkflow(workflowId);

    for (let attempt = 0; attempt < 8; attempt++) {
      await delay(2500);
      const result = await pollOnce(workflowId, executionId);
      if (result.status !== "pending") {
        return NextResponse.json(result);
      }
    }

    return NextResponse.json({ ok: true, workflowId, executionId, status: "pending" });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Client-side polling continuation for an execution that was still pending after the initial POST. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workflowId = searchParams.get("workflowId");
  const executionId = searchParams.get("executionId");

  if (!workflowId || !executionId) {
    return NextResponse.json({ ok: false, error: "workflowId and executionId query params are required." }, { status: 400 });
  }

  try {
    const result = await pollOnce(workflowId, executionId);
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
