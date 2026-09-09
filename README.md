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
- `WAYFINDER_API_KEY` — reserved, not yet used (see below).

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

Wayfinder (`WayfinderFoundation/wayfinder-paths-sdk`) is a real, separate
product — but its actual current public integration surface was researched
directly (its GitHub repo and `wayfinder-openclaw-skill/SKILL.md`, not
guessed) and turns out to be architecturally incompatible with a simple
server-route integration, for a real reason rather than a credentials gap:

- It exposes freeform operations (`quote_swap`, `execute` with kinds
  `swap`/`send`/`hyperliquid_deposit`) that are conceptually close to what
  Mastra's demo narrative needs.
- But it's explicitly documented as **a local MCP resource server** —
  commands run via `poetry run wayfinder` against a local
  `$WAYFINDER_SDK_PATH` and `WAYFINDER_CONFIG_PATH`. There is no confirmed
  public HTTP endpoint (unlike KeeperHub's clean hosted REST API) that a
  deployed Next.js server route can call.
- Making this real would mean standing up a separate, persistently-running
  Python service to host the SDK and expose it over HTTP — real
  infrastructure, not a Vercel API route, and exactly the "massive
  microservice architecture just to use the SDK" this project ruled out
  from the start.

So: not integrated, not because of a missing key or blocked network, but
because the real integration would require infrastructure this project
deliberately doesn't take on. The proposal Mastra shows today is a stand-in,
honestly labeled as such everywhere it appears, until that architecture
changes (either Wayfinder ships a hosted API, or this project takes on a
standalone Python service deliberately).

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
