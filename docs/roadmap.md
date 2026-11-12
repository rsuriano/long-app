# Long — roadmap

This document adds to [`long-plan.md`](long-plan.md). The plan contains the research, the
architecture, and the details of each decision. This document tells only what we build in
each version and what each version unblocks. There are no dates: the order is the
priority.

## v0 — Real basket from the wallet

**What it is.** The user describes an index. The AI makes the basket with the Coinbase
tokenized stocks on Base. The user buys the basket with one signature. The tokens stay as
separate tokens in the Smart Wallet of the user. The "index" is our record that groups
these positions.

**What we build:**
- A Next.js monorepo with the design of the mock.
- Coinbase Smart Wallet with a passkey. The paymaster charges the gas in USDC.
- A universe registry with the 10 Coinbase B20 tokens, as data that becomes larger.
- Prompt → basket with Claude and a deterministic validator.
- Quotes from 0x and execution in a batch with `sendCalls` (EIP-5792).
- The 0x affiliate fee on each swap, to our treasury.
- Home, Activity, and detail screens that read the on-chain balances and the metadata
  from our database.
- "Add funds": the address with a QR code, and instructions to send ARGt from Belo or
  USDC from a local exchange.
- Manual rebalance: a button that makes a new batch of swaps.
- US geoblock, consent, disclaimers.
- A curated list with only the baskets that the 10 stocks can make.

**No contracts of our own.** v0 does not have: an index as a token, automatic rebalance,
Sell, and ARGt payment if there is no ARGt/USDC liquidity.

**Unblocks.** A demo with real swaps on Base, and the first income from the entry fee.

## v1 — The index is a token (Reserve Index DTF)

**What it is.** We deploy each index as an ERC-20 basket with the Reserve factory (Folio)
on Base. The user has one token and can redeem it without us. The contract sends the TVL
fee to our treasury.

**What we build:**
- An execution adapter: swaps + DTF mint in the same batch. Redeem to sell.
- One DTF for each curated index. Personal baskets stay in v0 mode until we measure the
  cost to deploy one DTF for each user.
- Automatic rebalance: the AI has its own wallet and is the manager of the DTF. It uses
  the Reserve auctions. This connects to "agents with wallets" in the Base post.
- ARGt payment, with an ARGt → USDC swap as the first leg.
- Creators: a person who publishes an index that other people copy receives a part of the
  TVL fee.
- Full Sell, shared indices, Spanish version.
- A larger universe: an indexer that finds new B20 tokens. Also, Backed or Dinari tokens
  with the same registry, if they have liquidity on Base.

**Verify before you commit:** the B20 Policy Registry must not block the Folio contract as
a holder. Also verify the gas cost for each DTF and the Chainlink feed for each token.

**Unblocks.** The real business: an annual fee on assets under management, without
custody and without a broker license. Also composability: other protocols can use the
index token.

## v2 — Credit, yield, and distribution

**What it is.** The index is not only a holding. It becomes a productive asset and a
component that other parties can integrate.

**What we build:**
- Credit against the index: use the DTF token, or the separate B20 tokens, as collateral
  on Aave, Morpho, or Euler. These protocols already accept the B20 tokens. "Borrow USDC
  against your basket without a sale."
- Yield: dividends and, when they exist, yield mechanisms of the tokenized stocks, with
  automatic reinvestment in the index.
- Embedded onramp with Twin: pesos to ARGt in the app. Only if Twin offers the integration
  and if we do not hold custody.
- B2B API: prompt → basket → execution for local exchanges (Belo, Lemon, Ripio) that want
  to offer indices to their users.
- Indices with conditions: scheduled rebalances, rules such as "if X goes out of the top
  10, replace it". Later, strategies that combine with perps or prediction markets on the
  same stocks.
- Multi-region: BRAt for Brazil, and the local stablecoins that Twin adds.

**Unblocks.** Income that does not depend only on the buy volume: credit, yield, and
licensing. Also, a platform story, not an app story.

## Principles for all versions

- **Always non-custodial.** If a feature must hold user funds, we do not do it, or we give
  it to a licensed party.
- **No contracts of our own while an audited contract does the same thing.**
- **The universe is data, not a constant.** No part of the product assumes 10 stocks.
- **Base first.** Other chains only if an issuer with real liquidity is on a different
  chain.
