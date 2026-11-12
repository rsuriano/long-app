# @long/execution

This package is the on-chain layer of Phase 2. It reads prices and balances, gets quotes,
and makes the swaps on Base. The price and balance functions are **read-only**. They use
`eth_call` and do not need keys or gas.

```
pnpm --filter @long/execution try     # live prices of the 10 stocks
```

## Prices: two sources

- **Chainlink** (`readPrices`) — the reference price (total return). Long uses this price
  to calculate the value of the portfolio. The feeds are the official Coinbase feeds on
  Base. They are in `packages/universe/base.json`.
- **Aerodrome** (`poolPrice`) — the spot price of the pool. A swap executes near this
  price. The function reads the price from `slot0` of the Slipstream pool. Thus, it does
  not depend on the deployment.

Measured on 8 September 2026: the two sources agree within ±0.3% for all 10 stocks. This
cross-check confirms that the price is real.

## Base facts that were difficult to find

- **0x does not work for these stocks.** Its API rejects them (`NOT_AUTHORIZED_FOR_TRADE`,
  a legal restriction), for buys and for sells. For this reason, Long goes directly to
  Aerodrome.
- The tokens trade on a new Slipstream deployment. The factory is
  `0xf8f2eB4940CFE7d13603DDDD87f123820Fc061Ef`, and all pools have a tickSpacing of 10.
  The canonical Aerodrome quoter uses a different factory, and it reverts with these
  pools. For this reason, the executable price comes from `slot0`. The quote with
  slippage uses the quoter of this deployment (M3/M4).

## The swap (M3/M4)

`planBuy({recipient, usd, picks})` makes the buy of a basket. It does these steps:

1. It divides the USDC between the stocks by weight.
2. It gets a quote for each leg from `slot0` of the pool, less the pool fee (0.05%).
3. It returns the calls: one USDC `approve` to the router, and one `exactInputSingle` for
   each stock. Each swap has an `amountOutMinimum` with 1% slippage.

The Smart Wallet signs all calls in one batch (EIP-5792 `sendCalls`). The batch is atomic:
if one leg fails, the wallet spends nothing.

The router of this deployment is `0x698Cb2b6dd822994581fEa6eA4Fc755d1363A92F`. We found it
as the `sender` of recent Swap events on the NVDAc/USDC pool. Its `factory()` is our
factory. It has `exactInputSingle` with `tickSpacing` (int24), `multicall`, and `WETH9`.

```
pnpm --filter @long/execution dry-run                        # $5 of NVDAc
pnpm --filter @long/execution dry-run 10 TSLAc:35 NVDAc:35 SPCXc:30
```

The dry run simulates the same calls with `eth_call` and a *state override*. The override
gives a USDC balance and allowance to an account that does not exist. The real fill
agreed with the expected fill at 0.000% for all 10 stocks (9 September 2026). The dry run
costs nothing and does not sign anything.

The Long entry fee (0.5%, `FEE_BPS`) is a USDC transfer to the treasury (`TREASURY`,
`0x1c77…281C`) in the same batch. The stocks receive the remaining amount. Open item: a
quoter that walks the ticks, for large amounts.

`planSell({recipient, units, fraction})` is the reverse path. For each stock, it makes one
token `approve` to the router and one `exactInputSingle` from the stock to USDC. A sell
has no Long fee. We could not do a dry run of the sell, because the B20 tokens do not use
a known storage layout for the allowance. But the sell is symmetrical to the buy. Also,
the wallet simulates the batch before the signature. If the batch fails, all of it
reverts and nothing is sold.

ARGt (Twin, `ARGT_BASE`, 18 decimals) is verified on-chain. But it has no pool against
USDC on Aerodrome (no Slipstream pool and no v2 pool, 9 September 2026). The app shows
the ARGt balance, but it does not spend ARGt.
