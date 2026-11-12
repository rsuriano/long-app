# Deploy

## Today

The app runs on Vercel. `/api/basket` runs on the server, and this is necessary: if the
browser calls the model, the key becomes visible. The app does not use proprietary Vercel
features. Thus, it can move to a different host (for example, a Node service behind a
reverse proxy). A different host needs its own solution for the US geoblock.

## Vercel

Import the repository from the dashboard. Do this one time only:

1. Select **Add New → Project**, then select this repository.
2. Set **Root Directory: `apps/web`**. The repository is a pnpm monorepo. Vercel finds
   Next.js and the workspace automatically. You do not need a `vercel.json` file.
3. Set the **Environment Variables**:
   - `OPENROUTER_API_KEY`.
   - `LONG_ACCESS_PASSWORD`, if you want the access gate.
   - Optional: `LONG_AI_MODEL` and `LONG_AI_REASONING` (refer to `.env.example`).
4. Deploy. Each push to the production branch starts a new deploy. Other branches become
   previews.

If there is no model key, the app starts and the AI returns the template basket.

**If there is no password, the app is public** (since 9 September 2026). This is
intentional: we prefer to lock ourselves out than to publish the app by accident.

We verified locally that the build runs from `apps/web` with no other configuration.

## Access gate

During the private preview, there is one shared password and no user accounts. `proxy.ts`
is the middleware (Next 16 changed its name). It sends users without the cookie to
`/gate`. For API routes, it returns 401, so that these requests do not use the model. The
cookie contains a hash, not the password. The gate is off in development, so that it does
not stop your work.

In production, if `LONG_ACCESS_PASSWORD` is not set, the app is public. Then, these items
protect the model credit:

- The in-memory rate limit: 8 requests for each IP in 10 minutes, and 120 in one hour.
- The fleet rate limit in the database: 150 requests in one hour and 1,000 in one day
  (`lib/server/usage.ts`).
- The credit limit of the key on OpenRouter, as the last protection.

The gate is off in dev. To test the gate locally, run the production build:

```
pnpm build && pnpm --filter @long/web start
```

## Before the app becomes public

- [x] Rate limit on `/api/basket` (`apps/web/lib/rate-limit.ts`). It is in memory. It
      stops one person with curl, but it does not stop a distributed attack. Move it to
      the database when there is a database.
- [x] Basket cache: the chips and the curated list are pre-generated and committed
      (`apps/web/data/baskets.json`). Thus, they show immediately and do not use credit.
      When the universe, the prompt, or the model changes, run
      `pnpm --filter @long/web precompute` to make them again.
- [ ] US geoblock + consent + disclaimers (Phase 3). **Without these items, a real launch
      is not possible.** You can only show the app.
- [ ] A fast model: the cheap models take 5–45 s (refer to `packages/ai/README.md`).
