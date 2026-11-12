# Long — road to launch

This document records the steps from the first prototype to real swaps on Base. It adds
to `long-plan.md` and `roadmap.md`. For each step, it tells what we built and how it
operates.

## Where we are

- **Phase 0 and Phase 1: complete.** Monorepo, verified universe, ported mock, real prompt
  to basket (Gemini Flash Lite), cache, stocks screen, and corrected UX audit.
- Published at `long.bedrocklabs.dev` from Vercel (server, with access gate).
- **Phase 2 (real buy) and Phase 3 (compliance): complete** on 9 September 2026. M7
  (demo-ready) is the remaining step.

## Why the app needs a server

A static site cannot do these three things:

1. Keep the API keys secret. A key in the browser is visible, and other people can use
   all of the quota.
2. Apply the US geoblock. The geoblock must be on the server side, because users can skip
   a check on the client side.
3. Save the indices. This needs a database with a secret connection.

The app runs on Vercel. It uses nothing proprietary, so it can move to a different host
without a rewrite.

## The steps

### M1 — Quote from 0x → **cancelled, Long uses Aerodrome directly** (8 September 2026)

0x rejects all tokenized stocks (`NOT_AUTHORIZED_FOR_TRADE`, a legal restriction), for
buys and for sells. The liquidity is on Aerodrome Slipstream (NVDAc/USDC, USD 2.2M). The
price layer reads Chainlink (reference) and the spot price of the pool (executable). The
two prices agree within ±0.3%. The real swap uses Aerodrome (M3). The 0.5% entry fee goes
from the amount to the treasury, with no contract. **Complete.**

### M2 — Wallet and real balances **(complete, 9 September 2026)**

Coinbase Smart Wallet (passkey) is connected with `coinbaseWallet` in `smartWalletOnly`
mode. The app has these items:

- Connection.
- Real USDC balance.
- Real holdings, with values from Chainlink.
- Real address in Add funds.
- Account screen with logout.

With a connected wallet, no data is mock data. Without a wallet, the app shows a welcome
screen with Connect and a demo mode.

### M3 and M4 — First real buy, the basket with one signature **(complete, 9 September 2026)**

First real buy: USD 2 in Everything Elon. Three Aerodrome swaps in one batch, signed from
the Smart Wallet. The Coinbase paymaster charged the gas in USDC (USD 0.016), with no ETH
and no CDP. The 0.5% entry fee to the treasury is one more transfer in the same batch.

### M5 — Persistence **(complete, 9 September 2026)**

The database is Neon (Postgres). It has two tables:

- `indices`: one row for each index of each wallet (name, weights, units, cost).
- `purchases`: one row for each buy, with its tx.

The server **verifies each buy on the chain** before it writes the row. It reads the
receipt and gets the units from the Transfer events to the wallet. Thus, the record is
reliable without a login. Home and Activity read from these tables. Neon is connected
through the Vercel integration.

Before the signature, the browser saves an *intent*. If the browser does not record the
buy, the server reconciles it from the Transfer events on the chain. Without
`DATABASE_URL`, the app operates, but it does not save data.

Backfill: `pnpm --filter @long/web record <owner> <tx> "<name>" <usd> SYMc:weight …`.

Open item: the rate limit and the memory cache are still per instance.

### M6 — Compliance **(complete, 9 September 2026)**

- US geoblock at the edge (`x-vercel-ip-country`). It returns 451 and a "not available"
  page. Use `LONG_BLOCKED_COUNTRIES` to change the list.
- Declaration sheet before the first buy (not a US person + read the disclosures). The
  user signs it one time for each wallet and version. The app saves it with the country
  from the edge.
- Disclaimers on the declaration, the welcome screen, and the other screens.

**Next:** a signed login (SIWE) to edit and delete. Also, a legal person must examine the
text before the public launch.

### Sell *(complete, 9 September 2026, not in the original plan)*

On the detail screen of a real index, the user selects **Sell** → 25%, 50%, or all → one
signature. The batch has one swap from each stock to USDC. The server records the sell
from the tx (the tokens that left the wallet and the USDC that came back). It decreases
the units and the cost proportionally. If the user sells all, the index goes off the Home
screen and stays in Activity.

### M7 — Demo-ready *(the remaining work)*

- Test on Android with small amounts.
- Pay with ARGt when there is a pool. Today, the app shows the real balance, greyed out.
  The contract `0xf016…bdbDD` is verified, but there is no ARGt/USDC pool on Aerodrome.
- Manual rebalance v0.
- Final domain.

**Unblocks:** the public launch.
