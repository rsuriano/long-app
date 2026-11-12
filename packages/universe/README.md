# @long/universe

This package is the registry of the tokenized stocks on Base (Coinbase, B20 standard). The
registry is data that becomes larger with time. `base.json` is the source.
`src/index.ts` exports `getUniverse()`, `findBySymbol()`, `isTradeable()`, and
`validateBasket()`.

Addresses: never invent an address. Set `verified: true` only after you confirm the
address on Basescan or with `symbol()` through RPC. To complete and confirm the addresses,
use this command (it needs network access):

```
BASE_RPC_URL=https://mainnet.base.org pnpm --filter @long/universe verify
```

Weights: `capWeightsFor(symbols)` makes the index by market cap. The maximum weight is 35%
and the minimum weight is 5% (the same method as the Nasdaq-100). The table of market caps
(`marketCapUsdB`) is in `base.json`, with its date (`marketCapsAsOf`). The values are in
billions of USD, rounded. Update the table manually at each monthly rebalance. For SpaceX,
the table uses the valuation from its last private round.

Official source: https://www.base.org/stocks
