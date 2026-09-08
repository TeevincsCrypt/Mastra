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
- **KeeperHub execution** (`POST` / `GET /api/keeperhub/execute`) — a genuine call to `POST /api/workflows/{id}/execute`, followed by polling `GET /api/workflows/{id}/executions` until the execution reaches a terminal state. The transaction hash shown in the UI comes from KeeperHub's `transactionHashes` field on that response — never generated locally.
- **Failure handling** — a missing API key, an unreachable KeeperHub, a failed workflow, or a polling timeout all surface as real "FAILED" states in the UI with the actual error message, not a silent fallback to fake success.

**Not real (and clearly labeled as such in the UI):**
- **The Wayfinder proposal** ("Move 500 USDC from Base to Arbitrum") is Mastra's own representative workflow, generated locally in `src/lib/mock.ts`. Wayfinder's public API/SDK access wasn't available to wire up for this pass — see "Wayfinder integration status" below. The Workflow Review screen says so explicitly, in a banner above the action list.
- Because of that, the three-action bridge breakdown shown on Workflow Review (approve → bridge → receive, across Base/Arbitrum) is representative, not what actually executes. What actually executes is one small, pre-configured, real KeeperHub workflow on **Sepolia** — see `KEEPERHUB_WORKFLOW_ID` below. This is intentional: attempting a real cross-chain bridge as the first integration proof would not be a "smallest safe transaction."
- Wallet connection is simulated (generates a random address on click) — no real wallet provider is wired in.

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

## Wayfinder integration status

Wayfinder (`WayfinderFoundation/wayfinder-paths-sdk`) is a real, separate
product with its own Python SDK and `WAYFINDER_API_KEY`. It was not wired
into this build because, at the time of writing, we had neither a working
API key nor network access to `wayfinder.ai` from the development
environment to verify its request/response shapes firsthand — and this
project's rule throughout has been: don't guess API schemas, don't fabricate
a "live" response. The proposal Mastra shows today is a stand-in, honestly
labeled, until that integration can be built against a verified API surface.

If you do get real Wayfinder access, the natural seam for this is the same
pattern as KeeperHub: a `src/lib/wayfinder/client.ts` (server-only) and a
`src/app/api/wayfinder/proposal/route.ts` that the store calls instead of
`buildUsdcBridgeProposal()` in `src/lib/mock.ts`.

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
