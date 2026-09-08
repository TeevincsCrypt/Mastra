import "server-only";

/**
 * Thin server-only HTTP client for the real KeeperHub API.
 *
 * Confirmed facts this is built against (verified by the user against
 * KeeperHub's own docs, not guessed):
 *   - base URL: https://app.keeperhub.com
 *   - auth header: Authorization: Bearer <KEEPERHUB_API_KEY>
 *   - documented endpoint paths already include "/api" — do not prefix
 *     KEEPERHUB_BASE_URL with /api yourself.
 *   - a successful execution's status response exposes `transactionHashes`.
 *
 * What is NOT confirmed and is therefore handled defensively rather than
 * hardcoded: the exact shape of a workflow-creation body, the exact field
 * name KeeperHub uses for a freshly created execution's id, and the exact
 * set of status strings a workflow execution can be in. Every function
 * below normalizes a few plausible shapes and throws a KeeperHubError
 * carrying the raw response body on anything unexpected, so a real failure
 * surfaces the actual API response instead of a fabricated success.
 */

const KEEPERHUB_BASE_URL = "https://app.keeperhub.com";

export class KeeperHubError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "KeeperHubError";
    this.status = status;
    this.body = body;
  }
}

function getApiKey(): string {
  const key = process.env.KEEPERHUB_API_KEY;
  if (!key) {
    throw new KeeperHubError(
      "KEEPERHUB_API_KEY is not set in this environment's server-side config.",
      0,
    );
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
    throw new KeeperHubError(
      `KeeperHub ${init?.method ?? "GET"} ${path} responded ${res.status}`,
      res.status,
      body,
    );
  }

  return body;
}

export type KeeperHubWorkflow = Record<string, unknown>;

export interface KeeperHubExecution {
  id: string;
  status: string;
  transactionHashes?: string[];
  [key: string]: unknown;
}

/** GET /api/workflows/{workflowId} — used as the real "preflight" check: does this workflow exist and what does it target. Response shape isn't fully confirmed, so callers read fields defensively. */
export async function getWorkflow(workflowId: string): Promise<KeeperHubWorkflow> {
  const body = await keeperFetch(`/api/workflows/${encodeURIComponent(workflowId)}`);
  return asRecord(body, "getWorkflow");
}

/** GET /api/workflows — lists the organization's workflows. Used to discover a workflow by name when KEEPERHUB_WORKFLOW_ID isn't set, rather than requiring the id up front. */
export async function listWorkflows(): Promise<KeeperHubWorkflow[]> {
  const body = await keeperFetch("/api/workflows");
  if (Array.isArray(body)) return body as KeeperHubWorkflow[];
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    for (const key of ["workflows", "data", "items", "results"]) {
      if (Array.isArray(record[key])) return record[key] as KeeperHubWorkflow[];
    }
  }
  throw new KeeperHubError(
    "Unexpected KeeperHub response shape for workflow list — expected an array (checked top level and workflows/data/items/results).",
    200,
    body,
  );
}

/**
 * Resolves which workflow id to use for preflight/execute:
 *   1. KEEPERHUB_WORKFLOW_ID env var, if set — always wins, no API call needed.
 *   2. Otherwise, list the org's workflows via the real API. If exactly one
 *      exists, use it. If KEEPERHUB_WORKFLOW_NAME is set, match by name
 *      (case-insensitive). If neither narrows it to one workflow, throw with
 *      the real list of what was found so the caller can pick the right id.
 */
export async function resolveWorkflowId(): Promise<{ workflowId: string; workflow?: KeeperHubWorkflow }> {
  const configured = process.env.KEEPERHUB_WORKFLOW_ID;
  if (configured) return { workflowId: configured };

  const workflows = await listWorkflows();

  if (workflows.length === 0) {
    throw new KeeperHubError(
      "KEEPERHUB_WORKFLOW_ID is not set, and this KeeperHub organization has no workflows to discover. Create one in the KeeperHub dashboard first.",
      200,
    );
  }

  const targetName = process.env.KEEPERHUB_WORKFLOW_NAME?.trim().toLowerCase();
  const candidates = targetName
    ? workflows.filter((w) => typeof w.name === "string" && w.name.toLowerCase() === targetName)
    : workflows;

  if (candidates.length === 1) {
    const workflow = candidates[0];
    const id = firstString(workflow, ["id", "workflowId", "_id"]);
    if (!id) {
      throw new KeeperHubError(
        "Found exactly one matching KeeperHub workflow, but its response didn't contain a recognizable id field.",
        200,
        workflow,
      );
    }
    return { workflowId: id, workflow };
  }

  const summary = workflows
    .map((w) => `${firstString(w, ["name"]) ?? "(unnamed)"} [${firstString(w, ["id", "workflowId", "_id"]) ?? "no id"}]`)
    .join(", ");

  throw new KeeperHubError(
    candidates.length === 0
      ? `KEEPERHUB_WORKFLOW_NAME "${process.env.KEEPERHUB_WORKFLOW_NAME}" didn't match any workflow. Found: ${summary}`
      : `Multiple workflows found and none specified which to use. Set KEEPERHUB_WORKFLOW_ID or KEEPERHUB_WORKFLOW_NAME. Found: ${summary}`,
    200,
    workflows,
  );
}

/** POST /api/workflows/{workflowId}/execute — triggers a real execution. */
export async function executeWorkflow(workflowId: string): Promise<{ executionId: string; raw: unknown }> {
  const body = await keeperFetch(`/api/workflows/${encodeURIComponent(workflowId)}/execute`, {
    method: "POST",
  });
  const record = asRecord(body, "executeWorkflow");
  const executionId = firstString(record, ["executionId", "id", "execution_id"]);
  if (!executionId) {
    throw new KeeperHubError(
      "KeeperHub accepted the execute request but the response didn't contain a recognizable execution id (checked executionId/id/execution_id).",
      200,
      body,
    );
  }
  return { executionId, raw: body };
}

/** GET /api/workflows/{workflowId}/executions — confirmed execution-history endpoint; used to look up one execution's current status by id. */
export async function listExecutions(workflowId: string): Promise<KeeperHubExecution[]> {
  const body = await keeperFetch(`/api/workflows/${encodeURIComponent(workflowId)}/executions`);
  return asExecutionArray(body);
}

/** GET /api/workflows/executions/{executionId}/logs — confirmed execution-logs endpoint. */
export async function getExecutionLogs(executionId: string): Promise<unknown> {
  return keeperFetch(`/api/workflows/executions/${encodeURIComponent(executionId)}/logs`);
}

export async function findExecution(workflowId: string, executionId: string): Promise<KeeperHubExecution | undefined> {
  const executions = await listExecutions(workflowId);
  return executions.find((e) => e.id === executionId);
}

const SUCCESS_STATUS = /^(success|succeeded|completed|complete|confirmed|done)$/i;
const FAILURE_STATUS = /^(failed|failure|error|reverted|cancelled|canceled)$/i;

export function isTerminalSuccess(status: string): boolean {
  return SUCCESS_STATUS.test(status.trim());
}

export function isTerminalFailure(status: string): boolean {
  return FAILURE_STATUS.test(status.trim());
}

function asRecord(value: unknown, context: string): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new KeeperHubError(`Unexpected KeeperHub response shape in ${context} — expected a JSON object.`, 200, value);
}

function firstString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const v = record[key];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}

function asExecutionArray(value: unknown): KeeperHubExecution[] {
  if (Array.isArray(value)) return value as KeeperHubExecution[];
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["executions", "data", "items", "results"]) {
      if (Array.isArray(record[key])) return record[key] as KeeperHubExecution[];
    }
  }
  throw new KeeperHubError(
    "Unexpected KeeperHub response shape for execution list — expected an array (checked top level and executions/data/items/results).",
    200,
    value,
  );
}
