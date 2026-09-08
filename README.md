# Mastra

**Wayfinder × KeeperHub execution control center.**

Wayfinder thinks. Mastra verifies. KeeperHub executes.

Mastra sits between an autonomous agent that *proposes* on-chain workflows
and the execution layer that *runs* them. Every proposal is shown in full
before anything happens, dry-run simulated, and only executed after
explicit human approval — with a permanent audit record of exactly what ran.

## The flow

1. Connect a wallet
2. Receive a Wayfinder agent proposal (e.g. "Move 500 USDC from Base to Arbitrum")
3. Mastra displays the exact workflow — every action, contract, amount and chain
4. KeeperHub dry-runs and validates it
5. You approve or reject
6. KeeperHub executes the exact approved workflow
7. Mastra displays the real transaction
8. Every execution lands in an auditable history

## Screens

- **Dashboard** — agent status, pending actions, recent executions
- **Workflow Review** — every action, contract, amount, chain and simulation result
- **Execution** — live transaction progress
- **Audit Trail** — complete history of approved/executed workflows

## Running locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Click **Connect Wallet**
to start the demo — a Wayfinder proposal arrives automatically, ready to
review, simulate, and approve.

This build wires the full flow end-to-end against a deterministic mock
Wayfinder/KeeperHub backend (`src/lib/mock.ts`) so the demo is reliable and
self-contained; swapping in real wallet, agent, and execution integrations
means replacing that module and the wiring in `src/lib/store.ts`.
