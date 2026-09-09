# Mastra

**Wayfinder × KeeperHub execution control center.**

Wayfinder thinks. Mastra verifies. KeeperHub executes.

Mastra sits between an autonomous agent that *proposes* on-chain workflows
and the execution layer that *runs* them. Every proposal is shown in full
before anything happens, checked against KeeperHub, and only executed after
explicit human approval — with a permanent audit record of exactly what ran.

## What's real right now, and what isn't

This matters more than the rest of the README, so it comes first.

**Real:**
- **KeeperHub preflight** (`GET /api/keeperhub/preflight`) — a genuine, server-side, API-key-authenticated call to `https://app.keeperhub.com/api/workflows/{id}` confirming the configured workflow actually exists on KeeperHub. It's called "preflight," not "simulation," because KeeperHub's documented API doesn't expose a transaction dry-run separate from execution — this is real validation, just not a dry-run.
- **KeeperHub execution** (`POST` / `GET /api/keeperhub/execute`) — a genuine call to `POST /api/workflows/{id}/execute`, followed by polling `GET /api/workflows/{id}/executions` until the execution reaches a terminal state. The transaction hash shown in the UI comes from KeeperHub's `transactionHashes` field on that response — never generated locally. **Proven**: workflow `1f2xquu9elfdp1y4fje3g`, execution `v8blj68urln1zmwmwdncy`, real confirmed Sepolia transaction [`0x61dc1a128304a8918c3113ee514f20f89bf3d0ab71616ea1f512dd055ac1163d`](https://sepolia.etherscan.io/tx/0x61dc1a128304a8918c3113ee514f20f89bf3d0ab71616ea1f512dd055ac1163d), independently verified on Sepolia's explorer.
- **Failure handling** — a missing API key, an unreachable KeeperHub, a failed workflow, or a polling timeout all surface as real "FAILED" states in the UI with the actual error message, not a silent fallback to fake success.
- **Wallet connection** — real, via `wagmi` + `viem` (injected/MetaMask-style connector). Real connected address, real chain detection with a wrong-network prompt for anything but Sepolia, real disconnect, real connect/loading/error states. No address is ever generated or stored — see "Wallet architecture" below.

**Not real (and clearly labeled as such in the UI):**
- **The Wayfinder proposal** ("Move 500 USDC from Base to Arbitrum") is Mastra's own representative workflow, generated locally in `src/lib/mock.ts`. This is not a stopgap waiting on an API key — see "Wayfinder integration status" below for why it's a genuine architectural gap. The Workflow Review screen says so explicitly, in a banner above the action list.
- Because of that, the three-action bridge breakdown shown on Workflow Review (approve → bridge → receive, across Base/Arbitrum) is representative, not what actually executes. What actually executes is one small, pre-configured, real KeeperHub workflow on **Sepolia** — see `KEEPERHUB_WORKFLOW_ID` below. This is intentional: attempting a real cross-chain bridge as the first integration proof would not be a "smallest safe transaction."

## KeeperHub integration architecture

```
Browser (Zustand store)
  → fetch("/api/keeperhub/preflight" | "/api/keeperhub/execute")
    → src/app/api/keeperhub/*/route.ts   (Next.js server routes, KEEPERHUB_API_KEY read here only)
      → src/lib/keeperhub/client.ts      (thin fetch wrapper against https://app.keeperhub.com)
        → real KeeperHub API
```

`KEEPERHUB_API_KEY` never reaches the browser — it's read with `process.env` only
inside `src/lib/keeperhub/client.ts`, which is marked `import "server-only"` so
a build fails loudly if anything ever tries to pull it into client code.

## Required environment variables

See `.env.example`. All server-side only — never prefixed `NEXT_PUBLIC_`.

- `KEEPERHUB_API_KEY` — from app.keeperhub.com → Settings → API Keys → Organisation.
- `KEEPERHUB_WORKFLOW_ID` — the id of a workflow you create yourself in the
  KeeperHub dashboard: a small, safe, real action on Sepolia (e.g. a tiny
  native transfer). Mastra executes exactly this workflow when you click
  **Approve & Execute** — Mastra does not currently create workflows on your
  behalf, since KeeperHub's exact workflow-creation JSON schema wasn't
  confirmed against live documentation.
- `WAYFINDER_API_KEY` — read only by `wayfinder-service` itself (its own
  hosting platform's env vars), not by the Mastra app. Self-serve at
  https://strategies.wayfinder.ai/.
- `WAYFINDER_MCP_URL` — the URL of your deployed `wayfinder-service`. Not
  yet wired into the main flow (see "Wayfinder integration status") — only
  used by `/wayfinder-test` today.

## Security invariant

"The workflow KeeperHub executes must be exactly the workflow the user
approved" — enforced, not just asserted. `src/lib/approvalHash.ts` computes
a SHA-256 of the canonicalized (key-sorted) approved proposal the instant
`Approve & Execute` is clicked; `store.ts`'s `approveAndExecute` recomputes
that hash immediately before the actual execute call and compares. Any
mismatch sets execution to `failed` with `APPROVAL INVALIDATED` rather than
executing anything, and the hash is stored on every audit record
(`approvedWorkflowHash`) so it's independently checkable later. With today's
synchronous flow (approve and execute happen back-to-back against the same
in-memory object) this can't yet actually diverge — it's real,
tested-by-construction infrastructure for the moment there's a genuine gap
between approval and execution, which is exactly what dynamic KeeperHub
workflow creation (above) would introduce.

## Wallet architecture

The security model, confirmed by how KeeperHub's own API actually behaves
(there is no wallet-signature step anywhere in its workflow-execution
endpoints):

```
User connects real wallet (identity/authorization only)
  → reviews the exact proposed workflow
  → approves (their wallet address is recorded as the approver)
  → KeeperHub executes through its own non-custodial execution wallet
  → the transaction is signed and broadcast by KeeperHub, not the user
```

Mastra never invents a signature requirement that doesn't exist. The
connected wallet's job in this build is exactly what Part 2 of this
project's spec called for: identity and authorization, not transaction
signing. The Workflow Review and Audit Trail screens both label the
connected address explicitly as "identity only — not the executing wallet"
so this distinction is never implied to be something it isn't.

`src/lib/wagmi.ts` / `src/lib/useWallet.ts` — wagmi config (Sepolia only,
injected connector only, no WalletConnect project id needed) and a thin
hook exposing real connection/chain/error state to every screen.

## Wayfinder integration status

Deeper research (reading the SDK's actual source, not just its docs)
overturned the earlier conclusion that this was architecturally impossible.
Current, accurate status:

**What's real and built:**
- `wayfinder-service/` — a Dockerfile that runs the **official, unmodified**
  `wayfinder_paths.mcp.server` in its own `streamable-http` transport mode
  (a real, documented CLI option: `--transport streamable-http`), deployable
  to any small persistent host (Railway/Render/Fly). See that directory's
  own README for exact deploy steps.
- `src/lib/wayfinder/client.ts` — a real, server-only MCP client
  (`@modelcontextprotocol/sdk`) that connects to your deployed service and
  calls the SDK's real `onchain_quote_swap` tool. It never calls
  `onchain_swap` / `onchain_send` — those sign and broadcast internally
  using a locally-held key (confirmed from the SDK's own source), which
  would make Wayfinder a competing executor to KeeperHub. Wayfinder stays
  the routing/decision layer only; KeeperHub remains the sole executor.
- No private key anywhere in this integration. `onchain_quote_swap` needs a
  `wallet_label` referencing a configured wallet, but the SDK's wallet
  loader only requires `private_key_hex` inside the signing callback —
  which quote calls never reach. `wayfinder-service/config.json` has one
  watch-only entry (a placeholder address), nothing else.
- `/api/wayfinder/quote` and a diagnostic page at `/wayfinder-test` —
  reachable directly, not linked from the main nav — let you exercise a
  real Wayfinder quote once `WAYFINDER_MCP_URL` is set, independent of the
  main flow.

**What's genuinely still blocked, and why:** wiring a real quote into
Workflow Review's `Approve & Execute` would mean KeeperHub needs to execute
a *dynamic* workflow matching that exact quote — not the fixed
`KEEPERHUB_WORKFLOW_ID`. KeeperHub's real, documented workflow-creation
schema (`POST /api/workflows/create`, `{name, nodes, edges}`, action type
`web3/write-contract` confirmed with `{contractAddress, abi, abiFunction,
functionArgs}`) needs a *decoded* ABI function call. A swap quote's
calldata is very likely already-encoded raw transaction data from an
aggregator contract. Neither the exact shape of Wayfinder's calldata output
nor a KeeperHub action type that accepts raw (rather than decoded) calldata
could be confirmed from available sources. Building past that would mean
either guessing a translation, or silently substituting a simpler action
than what was actually approved — both explicitly ruled out, the second one
because it would violate the security invariant below. So: real quote data
is obtainable and demonstrable via `/wayfinder-test` today; it is
deliberately **not** wired into the main approve/execute flow, so the UI
never shows a real proposal next to an execution that doesn't match it.

## The flow

1. Connect a wallet
2. Receive a workflow proposal (currently Mastra's representative one; Wayfinder-sourced once integrated)
3. Mastra displays the exact workflow — every action, contract, amount and chain
4. KeeperHub confirms the configured execution workflow is real and ready (real API call)
5. You approve or reject
6. KeeperHub executes that workflow for real, on Sepolia
7. Mastra displays the real transaction hash from KeeperHub's response
8. Every execution — success or failure — lands in an auditable history

## Screens

- **Dashboard** — agent status, pending actions, recent executions
- **Workflow Review** — every action, contract, amount, chain, and the real KeeperHub preflight result
- **Execution** — live progress against the real KeeperHub execution, including real failure states
- **Audit Trail** — complete history of approved/executed workflows, including KeeperHub workflow/execution IDs

## Running locally

```bash
npm install
cp .env.example .env.local   # fill in KEEPERHUB_API_KEY and KEEPERHUB_WORKFLOW_ID
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Click **Connect Wallet**,
then **Review Workflow** → **Run KeeperHub Preflight** → **Approve & Execute**
to run the real flow against your configured Sepolia workflow.

Without those two environment variables set, the app still runs end-to-end —
preflight and execution will both report a real, honest failure explaining
exactly what's missing, rather than fabricating a result.
