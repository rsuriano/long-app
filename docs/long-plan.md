# Long — handoff plan: from the mock to a real product on Base

> This document was the handoff from the mock to the real repository. Written on 7
> September 2026. The mock is now in `docs/mock/`. Read all of this document before you
> change the code.

## 1. What Long is

Long is a very simple mobile app. It buys **personalized stock indices** made from
**tokenized stocks on Base**. The user writes in natural language what they want and what
they do not want ("AI without Zuckerberg"). An AI model makes the basket with weights. The
user adjusts the basket. Then the user buys it in one transaction. The user pays with USDC
or with a local-currency stablecoin (ARGt from Twin). Tagline: *Go long on what you
believe in.*

The Base post "Request for Builders: Tokenized Stocks" asks explicitly for *Personalized
Index Creation* and for *Neobrokerages* with local onramps and stablecoins. Long targets
both.

## 2. Status of the mock (complete, do not do again)

- One static page: `docs/mock/index.html` + `docs/mock/img/{usdc.png,argt.avif}`.
- The client simulates all functions. There is no wallet, no backend, and no real data.
- The design is decided and approved (do not open it again):
  - "Celeste" palette: background `#CFE1FF`, cards `#F7FAFF`, ink `#061B4A`, Base blue
    accent `#0052FF`, green `#128A4E`, red `#C8322F`. Light mode is the default.
  - Typography: Outfit (titles and numbers, tabular) + Instrument Sans (text).
  - Copy in English. Main buy button: **"Go long"**. Confirmation: **"You're long."**
  - Three tabs: Home, Build (center button), Activity. A wizard with 3 steps.
- Flow: Home → Build (prompt + chips) → basket with weight sliders and an editable title →
  amount and "Pay with" USDC/ARGt → confirmation with the hash → the index shows in Home
  and in Activity.
- Removed on purpose: gifting, bank onramp. Not included on purpose: Sell.
- Logos: the official USDC logo. ARGt uses the Twin logo (`argt.avif`). Both have a text
  badge as a fallback.

The mock is the UX specification. The new repository must copy these screens. Do not make
new screens.

## 3. Research: what is on Base today (September 2026)

### Coinbase Tokenized Stocks — the only real permissionless inventory

- Launched on 24 August 2026 with NVDAc, AAPLc, METAc, GOOGLc. On 4 September, Coinbase
  added AMZNc, MSFTc, TSLAc, SPCXc, SNDKc, MSTRc. **Total: 10 tickers**, all big tech.
  Some articles tell of 13 (COIN, CRCL, INTC). Verify at https://www.base.org/stocks.
- **B20** standard (an ERC-20 extension made by Base). After issuance, they are normal
  tokens: you can transfer and trade them without a wallet whitelist. Only Authorized
  Participants with KYC can mint and redeem against real stocks. Custodian: Alpaca.
- There is a **Policy Registry** that can block addresses (sanctions), and a
  `burnBlocked` function to freeze tokens. **The restriction on US users applies at the
  app level**, not at the chain level. We are responsible for the geoblock.
- Liquidity: pools on **Aerodrome** (USD 600K–1M for each token at launch). Routing
  through 0x, 1inch, KyberSwap, CoW Swap. Approximately USD 228M of DEX volume in 30 days.
- Prices: **Chainlink Data Feeds** 24/5, total return (includes dividends), 0.5%
  deviation, 24 h heartbeat.
- Aave, Morpho, and Euler already accept them as collateral. This opens the credit part
  of the Base post for later.

### Other issuers (not applicable to v0)

- **Backed / xStocks**: says that it is on Base. I could not confirm the contracts or the
  liquidity.
- **Dinari dShares**: 724 tickers on Base. But it uses a licensed API model with KYC for
  each user, for US investors. A possible source of more tickers later.
- **Ondo Stocks**: Ethereum, Solana, BNB. It is not on Base.

### Design result

The real universe is **10 stocks**. The "240 tokenized stocks" in the mock are a target,
not a fact. The product must use the universe as data that becomes larger (Coinbase
promises "thousands"). Never use it as a constant.

Baskets that we can make today:

- "AI without Zuckerberg" (NVDA, MSFT, GOOGL, AMZN, no META).
- "Mag 7 minus Tesla".
- "Everything Elon" (TSLA + SPCX).
- "Bitcoin proxies" (MSTR, COIN).

Baskets that we cannot make: LatAm, Chinese robotics, nuclear, GLP-1. Adjust the chips and
the curated list to the real universe.

## 4. Verdict for the demo

Viable, with one condition: the demo must execute real swaps on Base, also if the amount
is only USD 20. A better mock does not prove the product. A real buy of a 4-stock basket
with one signature proves it. The 10 stocks are sufficient to tell the story, because all
people know them. The story is "10 today, the infrastructure is ready for 1,000". The
universe as live data shows this.

Risks to name (do not hide them):

- A small universe.
- Dependency on Coinbase as the issuer.
- Pool liquidity of USD 1M limits the buy size.
- Regulation: we are an app, not an issuer. The US geoblock is mandatory.

## 5. Selected architecture

### v0: basket executed from the wallet, no contracts of our own

```
prompt ──▶ packages/ai (Claude + validator) ──▶ basket JSON {picks, weights, excluded, rationale}
                                                      │
                                                      ▼
                    packages/execution: 0x Swap API × N quotes (USDC → each B20)
                                                      │
                                                      ▼
            Coinbase Smart Wallet: sendCalls (EIP-5792) = N swaps with ONE signature
                                                      │
                                                      ▼
                    DB: user index {name, picks, weights, txHash, cost basis}
```

- **Wallet**: Coinbase Smart Wallet with a passkey. No seed phrase, no extension. It
  supports batches. Thus, "one transaction on Base" from the mock becomes literally true.
- **Execution**: 0x Swap API on Base (it routes to Aerodrome). Slippage for each leg. If
  one leg fails, the full batch fails (atomic). Start with USDC as the payment currency.
- **ARGt**: an ARGt → USDC swap as the first leg of the batch. Verify the ARGt/USDC
  liquidity on Base before you promise it. If there is no liquidity, v0 uses only USDC,
  and ARGt goes to the roadmap.
- **Onramp (add funds to the wallet)**: Coinbase Onramp does not work for Argentina.
  (Coinbase removed the ARS/USDC pair in January 2026.) In v0, the "Add funds" button
  shows the Smart Wallet address with a QR code and two instructions: "Send ARGt from
  Belo" (Belo is the Twin partner for ARGt) or "Send USDC from your exchange" (Ripio,
  Lemon, Belo, withdrawal to Base). No integration. Roadmap: embedded onramp with Twin.
- **Custom tokens in Smart Wallet**: the wallet can receive and spend any ERC-20 on Base
  (it is an ERC-4337 account). We read balances from the contract with viem. We do not
  depend on the Coinbase UI to list the token. Use the paymaster to pay gas in USDC: the
  user does not need ETH.
- **The index is in our database** (Postgres). The tokens stay in the wallet of the user.
  We lose "the index is a token", but we have zero contracts and zero audits.
- **Rebalance v0**: manual. A "Rebalance" button makes a new batch of swaps.

### v1 (roadmap): tokenized index with Reserve Index DTF

Reserve has a permissionless protocol on Base for ERC-20 baskets (Folio). It has pro-rata
mint and redeem, and rebalance through Dutch auctions. **The mint fee and the TVL fee go to
the creator of the basket. This is our income model**, with no contracts to write.
Repository: https://github.com/reserve-protocol/reserve-index-dtf.

Before you commit, verify these items:

- The B20 Policy Registry does not block the Folio contract.
- The gas cost to deploy one DTF for each user. (Possibly, one DTF for each curated index
  is better, with personal baskets in v0 mode.)
- Chainlink feeds exist for each B20 token. (They exist.)

Rejected, unless Reserve is not satisfactory: our own multi-asset vault (it needs an audit
and a new rebalance design).

### AI layer

- Model: Claude. Use the most capable model available. Read the `claude-api` skill before
  you select the ID and the prices.
- Input: the user prompt + the live universe with metadata for each stock (symbol, name,
  sector, country, CEO, one-line description, token address).
- Output: strict JSON `{ name, picks:[{symbol, weight}], excluded:[{symbol, reason}], note }`.
- A deterministic validator after the model. It checks these rules:
  - Each symbol is in the universe.
  - The weights are integers, and their sum is 100.
  - Minimum 3 names, maximum 10.
  - No excluded symbol is in the picks.
- If the validation fails, retry one time with the error in the prompt. If it fails
  again, return a template basket.
- The regex parser of the mock (`parsePrompt` in `index.html`) is a test fixture. The
  `SUGGEST` cases must give equivalent results.

### Minimum compliance

- US geoblock: by IP (Vercel/Cloudflare geo header) + a declaration checkbox for the user
  + save the consent. Without this, a launch is not possible.
- Permanent disclaimer: Long is the app, Coinbase is the issuer, Alpaca is the custodian,
  Twin is the issuer of ARGt. Nothing is advice.
- We do not hold custody: the wallet belongs to the user.

## 6. Scaffolding of the new repository

Suggested repository: `rsuriano/long`. Monorepo with pnpm + Turborepo. TypeScript in all
parts.

```
long/
├── apps/
│   └── web/                 Next.js (App Router), OnchainKit, wagmi, viem, Coinbase Smart Wallet
│       ├── app/             routes: / (home), /build, /activity, /explore, /i/[id]
│       ├── components/      port the mock: Hero, IndexRow, Wizard (3 steps), Sheet, TabBar
│       └── styles/          design tokens of the mock as CSS vars (copy from :root)
├── packages/
│   ├── universe/            registry of the tokenized stocks on Base
│   │   ├── base.json        10 Coinbase tokens: address, symbol, name, issuer, decimals,
│   │   │                    chainlinkFeed, sector, country, ceo, blurb
│   │   └── index.ts         getUniverse(), findBySymbol(), validateBasket()
│   ├── ai/                  promptToBasket() with Claude + validator + test fixtures
│   ├── execution/           quote(basket, amount, payToken) through 0x; buildCalls() for sendCalls
│   └── ui/                  (optional) shared primitives, if a second app comes
├── docs/
│   ├── long-plan.md         this file
│   └── mock/                the original HTML mock, UX reference (not served)
├── .env.example             ZEROX_API_KEY, ANTHROPIC_API_KEY, DATABASE_URL, CDP_PROJECT_ID
└── turbo.json, pnpm-workspace.yaml, tsconfig.base.json
```

Fixed decisions:
- Framework: **Next.js** (hosting on Vercel, free geo headers, edge for the geoblock).
- Wallet stack: **OnchainKit + wagmi + viem**, Coinbase Smart Wallet connector in
  `smartWalletOnly` mode.
- Swaps: **0x Swap API v2** (Base, chainId 8453). Do not use our own on-chain routers.
- DB: **Postgres** (Neon or Supabase) with Drizzle. Tables: users, indices,
  index_holdings, transactions, consents.
- Tests: Vitest. The `packages/ai` fixtures come from the chips of the mock.
- No CSS framework. Copy the tokens and the patterns of the mock. The app has the width of
  one screen. It does not need more.

## 7. Execution plan (order, not dates)

**Phase 0 — Repository and skeleton (1 day)**
1. Make the monorepo with the structure above, and a minimum CI (typecheck + tests).
2. Put the 10 Coinbase tokens in `packages/universe/base.json`. Get the addresses from
   https://www.base.org/stocks or Basescan. Make sure that each symbol ends in `c`. Do not
   invent addresses. If you cannot find an address, set `address: null` and block the buy.
3. Port the mock to React components. Do not change the design. Make it run with mock
   data.

**Phase 1 — Real prompt (1–2 days)** ✅ complete on 8 September 2026
4. ✅ `packages/ai`: promptToBasket, deterministic validator, one retry, and a fallback
   template. Injectable client: the tests run without a key. Refer to
   `packages/ai/README.md`.
5. ✅ Route handler `POST /api/basket`. The key is only on the server. The regex parser
   stays as an offline fallback if the API fails.
6. ✅ The three-step loading screen waits for the real response. It does not use a timer.
   Open item: the cheap model takes 5–45 s. The mock takes 1.5 s. The demo needs a fast
   model (Claude). This is a new adapter, not a rewrite.

**Phase 2 — Real buy (2–4 days)**
7. Connect the Smart Wallet. Read the balance of USDC and of each B20 token.
8. Get a quote from 0x for each leg. Show the summary (You go long with / fee / tokens
   minted).
9. `sendCalls` with all the legs. Confirmation with the real hash and a link to Basescan.
10. Save the index and the transaction. Home and Activity read from the database + the
    on-chain balances.

**Phase 3 — Demo-ready (1–2 days)**
11. Geoblock + consent + disclaimers.
12. Real curated list (only baskets that the 10 stocks can make).
13. Deploy on Vercel, domain, test on iPhone and Android with small real amounts.

**Later**: ARGt payment, Reserve DTF for tokenized indices, automatic rebalance,
Sell, shared indices, ES/EN.

## 8. Open questions (answer them in Phase 0)

- ~~What are the exact addresses of the 10 B20 tokens? Are there 10 or 13?~~ **Answered
  (8 September 2026).** There are **10**, not 13. base.org/stocks does not list COIN,
  CRCL, or INTC. (The articles about 13 tokens were too early.) The 10 addresses came from
  base.org/stocks. We confirmed them against Base mainnet with `symbol()`, `name()`, and
  `decimals()`. All agree, and all use **8 decimals**. They are in
  `packages/universe/base.json` with checksum and `verified: true`. When Coinbase adds
  tokens, validate again: `pnpm --filter @long/universe verify`.
- Does 0x route B20 tokens without special configuration? Test one NVDAc/USDC quote.
  **Next. Needs ZEROX_API_KEY.**
- Is there an ARGt/USDC pool on Base with usable liquidity? If not, ARGt goes out of v0.
- Does Belo let users withdraw ARGt to any address on Base? Confirm with a test.
- Does the Coinbase paymaster (CDP) sponsor or charge gas in USDC for these calls?
- Do Smart Wallet batches work with approvals + 0x swaps in one call? (They must work with
  `wallet_sendCalls`. Confirm with a test on mainnet with USD 5.)
- Does the B20 Policy Registry block intermediary contracts? (This is important for v1.)
- Does Coinbase supply a feed or an API with the list of tokenized stocks? (Then we do not
  have to keep the JSON manually.)

## 9. Sources

- Coinbase debuts tokenized stocks on Base (CoinDesk, 24/08/2026):
  https://www.coindesk.com/business/2026/08/24/coinbase-debuts-tokenized-stocks-on-base-network-joining-race-to-bring-equities-on-blockchain
- Base adds six new Coinbase tokenized stocks (Crypto Briefing, 04/09/2026):
  https://cryptobriefing.com/base-coinbase-tokenized-stocks-amazon-tesla/
- Official list: https://www.base.org/stocks
- B20 standard (Base blog): https://blog.base.dev/b20-tokenized-stocks-on-base
- Base docs, tokenized stocks: https://docs.base.org/base-chain/asset-issuance/tokenized-stocks-on-base
- Venues and protocols at launch (The Defiant): https://thedefiant.io/news/defi/coinbase-launches-tokenized-stocks-on-base
- Aerodrome and tokenized equities: https://cryptobriefing.com/aerodrome-tokenized-equities-base/
- 1inch supports the tokens: https://1inch.com/blog/post/coinbase-tokenized-stocks
- Reserve Index DTF: https://reserve.org/protocol/index_dtfs/overview/ and
  https://github.com/reserve-protocol/reserve-index-dtf
- Reserve TVL fee: https://docs.reserve.org/reserve-index/fees/tvl-fee
- Dinari 724 tokenized stocks: https://www.prnewswire.com/news-releases/in-an-industry-first-dinari-launches-724-tokenized-stocks-available-to-both-us-investors-and-businesses-302842099.html
- Overview of issuers in 2026 (Eco): https://eco.com/support/en/articles/15254023-tokenized-equities-2026-backed-dinari-robinhood
- Twin (ARGt, BRAt): https://www.twin.finance/
- ARGt on Belo: https://help.belo.app/en/articles/12833571-what-is-argt
- Coinbase stops ARS/USDC trading (January 2026): https://finance.yahoo.com/news/coinbase-exits-argentina-peso-usdc-104255126.html
- Coinbase Onramp demo app: https://github.com/coinbase/onramp-demo-application
- Base post "Request for Builders: Tokenized Stocks".

## 10. Business model (draft)

We are non-custodial. Thus, our income comes from on-chain fees, not from a broker spread.

1. **Entry fee for each swap** (v0, day one): the 0x Swap API accepts an `affiliateFee` in
   bps. This fee goes to our treasury wallet on each leg. Reference: 50 bps (0.5%) for
   each buy. With an average buy of USD 100, this is USD 0.50. It is volume income.
2. **Annual fee on the index** (v1, with Reserve DTF): the DTF TVL fee goes to the
   creator of the basket. Reference: 0.5% each year. The mock says 0.15% each year.
   Adjust the copy when we decide. This is the real business at scale. It is the
   Betterment/Wealthfront model (0.25% each year), but without custody or broker
   regulation.
3. **Curated indices with creators**: a person who publishes an index that other people
   copy receives a part of the TVL fee. This makes users into distributors.
4. **B2B**: the prompt → basket → execution layer as an API for local exchanges (Belo,
   Lemon, Ripio). These exchanges can offer indices without their own AI or execution.
5. Later: yield on the stocks that have yield, and credit against the index through
   Aave/Morpho. These protocols already accept B20 tokens as collateral.

Comparison: an Argentine broker charges 0.5–1% for each operation, plus a
monthly custody fee. A thematic ETF charges 0.5–0.75% each year and is not personal. Long
costs less and is personal.
