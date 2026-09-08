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
