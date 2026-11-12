import type { Address } from "viem";
import { findBySymbol } from "@long/universe";
import { basePublicClient, USDC_BASE } from "./client.ts";

// Aerodrome Slipstream (concentrated liquidity) on Base. The tokenized stocks trade in a
// newer Slipstream deployment whose factory is this one (verified by reading pool.factory()
// on the live NVDAc/USDC pool); the canonical Aerodrome quoter is bound to a different
// factory and reverts on these pools. So we read the spot price from the pool's slot0
// instead — the primary source, deployment-independent. A slippage-aware quote comes with
// the swap builder in M3/M4, using this deployment's own quoter.
const CL_FACTORY = "0xf8f2eB4940CFE7d13603DDDD87f123820Fc061Ef" as const;

// Slipstream pools are keyed by tickSpacing, not a fee tier. These are the ones the
// factory enables; the right one for a pair is found by asking the factory for each.
const TICK_SPACINGS = [1, 10, 50, 100, 200, 2000] as const;

const FACTORY_ABI = [
  { type: "function", name: "getPool", stateMutability: "view",
    inputs: [{ type: "address" }, { type: "address" }, { name: "tickSpacing", type: "int24" }],
    outputs: [{ type: "address" }] },
] as const;

const POOL_ABI = [
  { type: "function", name: "liquidity", stateMutability: "view", inputs: [], outputs: [{ type: "uint128" }] },
] as const;

const SLOT0_ABI = [
  { type: "function", name: "slot0", stateMutability: "view", inputs: [],
    outputs: [
      { name: "sqrtPriceX96", type: "uint160" }, { name: "tick", type: "int24" },
      { name: "observationIndex", type: "uint16" }, { name: "observationCardinality", type: "uint16" },
      { name: "observationCardinalityNext", type: "uint16" }, { name: "unlocked", type: "bool" },
    ] },
  { type: "function", name: "token0", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const;

const ZERO = "0x0000000000000000000000000000000000000000";

/** The Slipstream pool for a pair, and the tickSpacing that keys it. Deepest one wins. */
export async function findPool(tokenA: Address, tokenB: Address, client = basePublicClient()) {
  const pools = await client.multicall({
    contracts: TICK_SPACINGS.map((ts) => ({ address: CL_FACTORY, abi: FACTORY_ABI, functionName: "getPool", args: [tokenA, tokenB, ts] }) as const),
    allowFailure: true,
  });
  const found = pools
    .map((p, i) => ({ address: p.status === "success" ? (p.result as Address) : ZERO, tickSpacing: TICK_SPACINGS[i]! }))
    .filter((p) => p.address !== ZERO);
  if (found.length === 0) return null;
  if (found.length === 1) return found[0]!;
  // More than one tickSpacing has a pool: pick the one with the most liquidity.
  const liq = await client.multicall({
    contracts: found.map((f) => ({ address: f.address, abi: POOL_ABI, functionName: "liquidity" }) as const),
    allowFailure: true,
  });
  let best = found[0]!, bestLiq = -1n;
  found.forEach((f, i) => {
    const l = liq[i]!.status === "success" ? (liq[i]!.result as bigint) : 0n;
    if (l > bestLiq) { bestLiq = l; best = f; }
  });
  return best;
}

export type PoolPrice = { symbol: string; pool: Address; tickSpacing: number; usdcPerToken: number };

/**
 * The Aerodrome spot price of a tokenized stock in USDC, read from the pool's slot0. This
 * is the market price a swap executes near (the exact fill depends on size and slippage,
 * which the swap builder handles in M3/M4). Read-only; null if there is no pool.
 */
export async function poolPrice(symbol: string, client = basePublicClient()): Promise<PoolPrice | null> {
  const token = findBySymbol(symbol);
  if (!token?.address) return null;

  const pool = await findPool(USDC_BASE, token.address as Address, client);
  if (!pool) return null;

  const [slot0, token0] = await Promise.all([
    client.readContract({ address: pool.address, abi: SLOT0_ABI, functionName: "slot0" }),
    client.readContract({ address: pool.address, abi: SLOT0_ABI, functionName: "token0" }),
  ]);
  const sqrtPriceX96 = (slot0 as readonly unknown[])[0] as bigint;

  // (sqrtPriceX96 / 2^96)^2 = price of token1 in units of token0, both raw. Then adjust
  // for decimals to get USDC per whole stock, regardless of which token is token0.
  const ratio = (Number(sqrtPriceX96) / 2 ** 96) ** 2; // token1 per token0, raw
  const usdcIsToken0 = (token0 as string).toLowerCase() === USDC_BASE.toLowerCase();
  const stockDec = token.decimals ?? 8;
  const usdcDec = 6;
  const usdcPerToken = usdcIsToken0
    ? (1 / ratio) * 10 ** (stockDec - usdcDec) // token1 is the stock
    : ratio * 10 ** (stockDec - usdcDec); // token0 is the stock
  return { symbol: token.symbol, pool: pool.address, tickSpacing: pool.tickSpacing, usdcPerToken };
}
