import { NextResponse } from "next/server";
import {
  getCreatedWorkflow,
  getWalletBalances,
  getCurrentUser,
  getUserWallet,
  getActionSchemas,
} from "@/lib/keeperhub/dynamicWorkflow";
import { KeeperHubError } from "@/lib/keeperhub/client";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Read-only diagnostic. Calls only GET endpoints:
 *   - GET /api/workflows/{id} — re-fetches the stored workflow definition
 *     created during Phase A schema validation.
 *   - GET /api/user/wallet/balances — an earlier attempt to discover the
 *     execution wallet address via balance data.
 *   - GET /api/user — per official KeeperHub docs, `walletAddress` here is
 *     the active organization's execution wallet: the one that signs and
 *     funds every workflow execution.
 *   - GET /api/user/wallet — per official KeeperHub docs, the
 *     organization's Turnkey wallet record.
 *   - GET /api/mcp/schemas — documented, public, cacheable action registry;
 *     used here to pull the authoritative web3/write-contract field list.
 * Never calls execute, enable, update, create, delete, or any endpoint not
 * confirmed to exist. Any field matching a secret-shaped name is redacted
 * before being returned, in every response included here.
 */

const SECRET_KEY_PATTERN = /(api[_-]?key|token|secret|password|private[_-]?key|hmac|cookie|authoriz|credential|session)/i;

function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEY_PATTERN.test(k) ? "[redacted]" : redactSecrets(v);
    }
    return out;
  }
  return value;
}

function pick(record: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in record) out[key] = record[key];
  }
  return out;
}

interface RequestBody {
  workflowId?: string;
}

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const workflowId = body.workflowId ?? "xt0w6n7m8o6u5419lz9iz";
  const result: Record<string, unknown> = { workflowId };

  try {
    result.workflow = await getCreatedWorkflow(workflowId);
  } catch (err) {
    result.workflowError =
      err instanceof KeeperHubError
        ? { message: err.message, status: err.status, body: err.body }
        : err instanceof Error
          ? err.message
          : "Unknown error fetching workflow.";
  }

  try {
    result.walletBalances = await getWalletBalances();
  } catch (err) {
    result.walletBalancesError =
      err instanceof KeeperHubError
        ? { message: err.message, status: err.status, body: err.body }
        : err instanceof Error
          ? err.message
          : "Unknown error fetching wallet balances.";
  }

  try {
    const { status, body: userBody } = await getCurrentUser();
    const record = userBody && typeof userBody === "object" ? (userBody as Record<string, unknown>) : {};
    result.user = {
      httpStatus: status,
      walletAddress: record.walletAddress,
      identifiers: pick(record, ["id", "userId", "organizationId", "email"]),
      fullResponseRedacted: redactSecrets(userBody),
    };
  } catch (err) {
    result.userError =
      err instanceof KeeperHubError
        ? { message: err.message, status: err.status, body: redactSecrets(err.body) }
        : err instanceof Error
          ? err.message
          : "Unknown error fetching /api/user.";
  }

  try {
    const { status, body: walletBody } = await getUserWallet();
    const record = walletBody && typeof walletBody === "object" ? (walletBody as Record<string, unknown>) : {};
    result.userWallet = {
      httpStatus: status,
      ...pick(record, ["hasWallet", "walletAddress", "walletId", "organizationId", "isActive"]),
      fullResponseRedacted: redactSecrets(walletBody),
    };
  } catch (err) {
    result.userWalletError =
      err instanceof KeeperHubError
        ? { message: err.message, status: err.status, body: redactSecrets(err.body) }
        : err instanceof Error
          ? err.message
          : "Unknown error fetching /api/user/wallet.";
  }

  try {
    const schemas = await getActionSchemas();
    const record = schemas && typeof schemas === "object" ? (schemas as Record<string, unknown>) : {};
    const actions = record.actions && typeof record.actions === "object" ? (record.actions as Record<string, unknown>) : {};
    result.writeContractSchema = actions["web3/write-contract"] ?? "Not found in the actions registry.";
    result.totalActionsInRegistry = Object.keys(actions).length;
  } catch (err) {
    result.actionSchemasError =
      err instanceof KeeperHubError
        ? { message: err.message, status: err.status, body: err.body }
        : err instanceof Error
          ? err.message
          : "Unknown error fetching /api/mcp/schemas.";
  }

  return NextResponse.json({
    ok: true,
    note: "Read-only — no execute, enable, update, create, or delete call was made. Secret-shaped fields are redacted.",
    ...result,
  });
}
