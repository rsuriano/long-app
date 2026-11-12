# Long

**Go long on what you believe in.**

Long makes personalized stock indices from tokenized stocks on Base. You write what you
want and what you do not want. An AI model makes the basket. You adjust the weights. Then
you buy the full basket in one transaction. You pay with USDC or with a local stablecoin.

The full plan is in [`docs/long-plan.md`](docs/long-plan.md). It contains the research on
the issuers on Base and the selected architecture. The order of the versions is in
[`docs/roadmap.md`](docs/roadmap.md). Read these two documents fully before you change
the code.

The approved UX mock is in [`docs/mock/index.html`](docs/mock/index.html). You can see it
live at https://long.bedrocklabs.dev. The mock is the design specification. The real
product copies these screens. Do not make a new design.

## Status

Phases 0 to 3 are complete (9 September 2026). The app does these things on Base mainnet:

- It changes a prompt into a basket with an AI model and a deterministic validator.
- It buys the full basket with one signature from a Coinbase Smart Wallet. The paymaster
  charges the gas in USDC.
- It sells 25%, 50%, or all of an index with one signature.
- It saves the indices and the buys in Postgres. The server verifies each buy on the
  chain.
- It blocks US users and asks for an eligibility declaration before the first buy.

The remaining step is M7 (demo-ready). Refer to
[`docs/road-to-launch.md`](docs/road-to-launch.md).

## Repository

```
apps/web             Next.js (App Router). Routes: /, /build, /explore, /stocks, /activity,
                     /account, /i/[id], plus /api/*
packages/ai          Prompt → basket: model, validator, retry, and template fallback
packages/execution   Prices (Chainlink + Aerodrome), buy and sell plans for the batch
packages/universe    Registry of the 10 Coinbase B20 tokens on Base + basket validator
docs/                Plan, roadmap, deploy notes, and reference mock
```

There is no CSS framework. `apps/web/app/globals.css` contains the tokens and the patterns
of the mock, copied without changes. `apps/web/lib/mock-ai.ts` is the regex parser of the
mock, limited to the real universe. `packages/ai` is the real parser. The regex parser
stays as the offline fallback, and its cases are test fixtures.

## Run

```
pnpm install
pnpm dev          # http://localhost:3000
pnpm typecheck
pnpm test
```

Requirements: Node 22 or later, and pnpm 10. The environment variables are in
`.env.example`. The app starts without them:

- Without `OPENROUTER_API_KEY`, the AI returns template baskets.
- Without `DATABASE_URL`, the app does not save indices.

For the deploy, refer to [`docs/deploy.md`](docs/deploy.md).
