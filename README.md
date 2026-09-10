# Mastra

**Autonomous on-chain finance — a control plane, not a wallet.**

> "Give your agent a budget. Not your private key."

Mastra sits between an agent that *proposes* on-chain actions and KeeperHub,
the execution layer that *runs* them for real on Ethereum mainnet. In
between sits a deterministic policy engine that decides — in code, not in an
LLM's opinion — whether a proposed execution is allowed at all. The core
rule this whole project is built around:

**AI proposes. Policies decide. KeeperHub executes.**

An agent that can call `execute()` directly, with nothing in between, is a
live financial liability. Mastra's job is to be that boundary.

## What's real right now, and what isn't

This matters more than the rest of the README, so it comes first.

**Real, and independently exercisable from the running app:**

- **The deterministic policy engine** (`src/lib/policy/evaluate.ts`) — a
  pure function, no LLM involved, checking chain, input/output token,
  per-execution limit, daily budget, monthly budget, slippage, router
  allowlist, and quote freshness. Test any amount against any automation's
  real policy on the **Policies** page and see the exact check that passes
  or fails.
- **Real spending budgets** — derived entirely from persisted
  `ExecutionRecord`s where `keeperhubExecuteCalled && status === "success"`
  (`src/lib/store/executions.ts#sumSpentSince`). Never a separately-tracked
  counter that could drift from what actually happened on-chain.
- **Real Wayfinder quotes** via the official Wayfinder Paths SDK's MCP
  server (`onchain_quote_swap`, `onchain_resolve_token`) — quote-only, never
  signs or broadcasts. Exercise it live on the **Integrations** page.
- **Real KeeperHub execution** on Ethereum mainnet — Mastra creates a
  dynamic KeeperHub workflow matching the exact quoted route and calldata,
  calls KeeperHub's real preflight and execute endpoints, and polls for the
  real terminal state. The transaction hash, gas used, and execution ID
  shown anywhere in the UI come directly from KeeperHub's own API response
  — never generated or guessed locally. **Confirmed**: a real automation
  execution through this exact pipeline (policy evaluation → KeeperHub
  workflow → on-chain confirmation) produced
  [`0xcf263352f2725ff990b6597598a44575fdf6a6522689767d3c78f298c349e3fe`](https://etherscan.io/tx/0xcf263352f2725ff990b6597598a44575fdf6a6522689767d3c78f298c349e3fe)
  on Ethereum mainnet.
- **The approval-hash invariant** (`src/lib/approvalHash.ts`) — a SHA-256 of
  the canonicalized approved proposal, recomputed immediately before
  execution and compared; any mismatch blocks execution with
  `APPROVAL INVALIDATED` rather than proceeding.
- **A real, first-class blocked-execution state** — when policy rejects a
  proposed amount, KeeperHub is never called (`keeperhubExecuteCalled:
  false`). This is the demo's key feature, not an edge case: the agent does
  not control the money.
- **Real sign-in-with-wallet authentication** — a challenge message signed
  by the connected wallet, verified server-side (viem's `verifyMessage`),
  backing a stateless HMAC-signed session cookie. A connected MetaMask alone
  proves nothing in this app; only a verified signature does.
- **A real operator allowlist** (`MASTRA_AUTHORIZED_EXECUTORS`) gating the
  one route that can actually spend from KeeperHub's shared wallet, and a
  **real, server-side emergency pause** checked authoritatively inside the
  execution path before any Wayfinder or KeeperHub call.
- **A real, persisted audit trail** — every stage an execution passes
  through (trigger received, quote requested, policy evaluated, KeeperHub
  preflight, execution started, transaction confirmed, etc.) is written to
  the file-backed store as it happens, visible on the **Audit** page.

**Not real, and clearly labeled as such in the UI:**

- **Automation triggers.** No automation in this build fires on a real
  time/price/gas-threshold event. Every execution — including the four
  strategy templates (ETH Auto-DCA, Gas Guardian, Take Profit Guardian,
  Treasury Rebalancer) — is manually triggered from the Execution Center.
  Each template's `triggerDescription` and `triggerLive: false` say this
  explicitly; nothing pretends to be scheduled that isn't.
- **Per-user custody.** Real execution still spends from KeeperHub's own
  shared, operator-funded wallet, not a wallet unique to the person who
  clicked Execute. The security boundary this build enforces is *who may
  direct that spend and under what limits* (see Security model below) —
  not custody itself. This is stated plainly on the Security page and the
  landing page; the architecture is never described as non-custodial.
- **USD-denominated amounts.** There's no live USD price feed wired in, so
  every amount in this app is a token-native decimal (e.g. "1.2 USDC"),
  never a fabricated dollar figure.
- **Fund/vault isolation.** There's no per-automation on-chain vault or
  audited isolation contract — that would require a real, audited contract
  deployment, explicitly ruled out for this build. The policy engine is the
  honest substitute: an off-chain, server-side boundary, not smart-contract
  enforcement.

## Architecture — five layers, one rule

The full breakdown, cross-linked to the pages that back each claim with a
live endpoint, lives at `/architecture` in the running app. Short version:

```
User            → Identity only. Signs a challenge to prove who they are;
                  never signs the execution transaction.
Wayfinder       → Finds the route. Real quote + calldata via MCP.
                  Never signs, never moves funds.
Mastra          → The control plane. Automations, the deterministic policy
                  engine, budgets, audit trail, sessions, emergency pause.
                  Never holds a key, never calls the chain directly.
KeeperHub       → The only thing that signs. Mastra asks it to execute a
                  specific, policy-approved, quote-matched payload —
                  nothing more.
Blockchain      → Ethereum mainnet. The verified Universal Router at
                  0xEbE0FA42523F69Ea1E97F5B08282654c19c2c0Ee, confirmed
                  from real decoded transaction logs, not assumed from
                  stock Uniswap docs.
```

The layer that decides is never the layer that signs.

## Execution lifecycle

An automation moves through `draft → policy_review → approved → deployed →
active`. Triggering an execution (manually, from the Execution Center)
walks a single run through:

```
TRIGGER_RECEIVED
  → (blocked here if the system is paused)
WAYFINDER_QUOTE_REQUESTED → QUOTE_RECEIVED
POLICY_EVALUATION → POLICY_APPROVED | POLICY_BLOCKED
  → (KeeperHub is never called past this point if blocked)
KEEPERHUB_PREFLIGHT → APPROVAL_VERIFIED
KEEPERHUB_EXECUTION_STARTED
TRANSACTION_CONFIRMED | TRANSACTION_REVERTED
EXECUTION_COMPLETE | EXECUTION_FAILED
```

Every stage is written as a real `AuditEvent`, in order, as it happens
(`src/lib/policy/runAutomationExecution.ts`).

## Policy system

Each `Automation` has exactly one `Policy` (`src/lib/store/types.ts`):
max amount per execution, daily/monthly limits, allowed chains, allowed
input/output tokens, max slippage (bps), an allowed-router list (defaulting
to the one independently verified router), quote-freshness requirements,
and whether preflight/approval-hash checks are required. `evaluatePolicy()`
is pure and deterministic — same inputs, same decision, every time — and
returns a full `PolicyDecision` with a pass/fail result for every
individual check, not just a yes/no.

## Budget model

Spend is computed by summing `requestedAmount` across every
`ExecutionRecord` where `keeperhubExecuteCalled` is true and `status` is
`"success"`, within the relevant window (`GET /api/budget`). A blocked or
failed-before-execute attempt never counts — nothing moved on-chain, so it
never should have moved against budget.

## Security model

Five layered, independently real checks — the full detail lives on the
**Security** page in the running app:

1. **Sign-in-with-wallet** — a signed challenge, verified server-side,
   issues a session cookie. Never trust a client-supplied address alone.
2. **Operator allowlist** (`MASTRA_AUTHORIZED_EXECUTORS`) — gates who can
   trigger real spend or lift an emergency pause. Unset means any signed-in
   wallet can execute — a disclosed gap, not a silent one.
3. **Deterministic policy engine** — evaluated before KeeperHub is ever
   called, every time.
4. **Emergency pause** — server-side and authoritative, checked inside the
   execution path itself, not just hidden behind a UI button.
5. **KeeperHub as sole executor** — Mastra never holds or requests
   KeeperHub's private key.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in what you need — see below
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). `npm run build` and
`npm run lint` should both be clean before pushing — this project treats
lint/type errors as real bugs, not noise to route around.

### Environment variables

See `.env.example` for the full, current list with inline explanations.
Highlights:

- `MASTRA_SESSION_SECRET` — **required, no fallback.** The app throws on
  boot without it. Signs session cookies; use a long random value.
- `MASTRA_AUTHORIZED_EXECUTORS` — optional, comma-separated wallet
  addresses allowed to trigger real execution or lift a pause.
- `KEEPERHUB_API_KEY` — from app.keeperhub.com → Settings → API Keys.
- `WAYFINDER_MCP_URL` — your deployed `wayfinder-service` (see that
  directory's own README) — a persistent host running the official
  Wayfinder Paths SDK's MCP server, since serverless functions can't run
  one themselves.
- `MAINNET_RPC_URL` — optional; falls back to a public no-API-key RPC.
- `ANTHROPIC_API_KEY` — optional, powers the separate Mastra AI chat
  assistant (`/ai`). Read automatically by the Anthropic SDK.

All server-side only — none are ever prefixed `NEXT_PUBLIC_`.

### Storage

Persistence (`src/lib/store/fileStore.ts`) has two real backends:

- **Redis** (Upstash) when `KV_REST_API_URL`/`KV_REST_API_TOKEN` (or
  `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`) are set — real,
  shared state across every serverless instance. **Required for Vercel** —
  add a free Upstash Redis database from the Vercel dashboard's Storage tab
  (Marketplace → Upstash for Redis); it auto-injects the env vars on
  redeploy, no code change needed.
- **A local JSON file** (`.data/`, gitignored) otherwise — used for local
  dev, where one long-running process doesn't have a cross-instance
  problem.

Without Redis configured, Vercel deployments fall back to writing under
`/tmp` (writable there, unlike `process.cwd()`) so the app doesn't crash —
but `/tmp` is **not shared across serverless instances and doesn't survive
a cold start**, so an automation created in one request can come back
"not found" in the next. This is the actual cause if you see that error on
a deployment without Redis configured — add it rather than working around
it.

## Deployment

Deployed on Vercel, tracking `main`. Set the environment variables above in
the Vercel project settings (Production + Preview as needed). Because
storage is file-backed, a Vercel deployment's persisted data does not
survive across deployments/cold starts unless the hosting environment
provides a persistent filesystem — this is a known limitation, not a bug,
and is the honest tradeoff of not provisioning a real database for this
build.

## Mainnet setup

Real execution runs on Ethereum mainnet — there is no silent fallback to a
testnet. To exercise it for real you need:

1. A KeeperHub account and API key with a funded execution wallet.
2. `WAYFINDER_MCP_URL` pointing at a deployed `wayfinder-service`.
3. `MASTRA_SESSION_SECRET` set, and optionally `MASTRA_AUTHORIZED_EXECUTORS`
   restricting who can actually trigger a spend.

Without KeeperHub/Wayfinder credentials configured, the app still runs
end-to-end — every affected page reports a real, honest "not configured" or
error state (see `/api/system/health`) rather than fabricating a result.

## Known limitations

- No automation fires on a real trigger event yet — every execution is
  manual. See "What's real right now" above.
- Not fully non-custodial — see "Security model" above.
- No per-automation on-chain vault or fund isolation contract.
- Redis-backed when configured (see "Storage" above), but still a simple
  whole-collection key-value store, not a relational database — fine at
  this data volume, not built to scale past it.
- The `MASTRA_AUTHORIZED_EXECUTORS` allowlist is optional; if unset, any
  signed-in wallet can trigger real spend.
- The Mastra AI chat assistant (`/ai`) is informational only — it never
  creates, approves, or executes an automation directly. Natural-language
  automation creation is not wired into `/automations/new`; that flow uses
  direct structured configuration instead, consistent with the project's
  core rule that an LLM never executes directly.

## Hackathon demo walkthrough

1. **Architecture** (`/architecture`) — the five-layer split.
2. **Overview** (`/overview`) — real system health, real automations, real
   budget usage, all pulled from the same store and health checks the rest
   of the app reads from.
3. **Create an automation** (`/automations/new`) — pick a template or go
   custom, set policy limits, sign in with your wallet, approve.
4. **Policies** (`/policies`) — test an over-limit amount against the new
   automation's real policy and watch it come back `BLOCKED`, with the
   exact failing check.
5. **Execute** (`/automations/[id]`) — trigger a real run within policy and
   watch it walk through every real stage to a confirmed mainnet
   transaction; trigger one over the limit and watch it stop at
   `POLICY_BLOCKED` — **KeeperHub is never called.** The agent does not
   control the money. Mastra controls the agent. KeeperHub executes only
   what policy permits.
6. **Integrations** (`/integrations`) — the real KeeperHub execution wallet
   and its on-chain balances, recent real workflow executions, and a live
   Wayfinder quote tester.
7. **Security** (`/security`) — the real authorization model, and the
   emergency pause toggle itself.
8. **Audit** (`/audit`) — the full, real, server-side event trail for every
   execution above.
