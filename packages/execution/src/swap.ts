import { encodeFunctionData, parseUnits, type Address, type Hex } from "viem";
import { findBySymbol } from "@long/universe";
import { basePublicClient, USDC_BASE } from "./client.ts";
import { findPool } from "./quote.ts";

/**
 * Buying a tokenized stock with USDC on Aerodrome Slipstream, as calls the Smart Wallet
 * signs in one batch (EIP-5792 sendCalls): one USDC approval for the total, then one
 * exactInputSingle per stock. Everything here is pure — no signing, no sending — so the
 * web app and the dry-run script build exactly the same calldata.
 *
 * The router belongs to the same newer Slipstream deployment as the pools (its factory()
 * is CL_FACTORY): found as the `sender` of recent Swap events on the NVDAc/USDC pool and
 * confirmed by its selectors (exactInputSingle with int24 tickSpacing, multicall, WETH9).
 */
export const SWAP_ROUTER = "0x698Cb2b6dd822994581fEa6eA4Fc755d1363A92F" as const;

/**
 * Long's entry fee: 0.5% of what goes in, sent to the treasury as one more USDC transfer
 * in the same batch (docs/long-plan.md). Public config, not a secret.
 */
export const TREASURY = "0x1c77f016a93E814fbAd08Cd9625e825bE6ae281C" as const;
export const FEE_BPS = 50;

export const ROUTER_ABI = [
  { type: "function", name: "exactInputSingle", stateMutability: "payable",
    inputs: [{ name: "params", type: "tuple", components: [
      { name: "tokenIn", type: "address" }, { name: "tokenOut", type: "address" },
      { name: "tickSpacing", type: "int24" }, { name: "recipient", type: "address" },
      { name: "deadline", type: "uint256" }, { name: "amountIn", type: "uint256" },
      { name: "amountOutMinimum", type: "uint256" }, { name: "sqrtPriceLimitX96", type: "uint160" },
    ] }],
    outputs: [{ name: "amountOut", type: "uint256" }] },
] as const;

export const ERC20_ABI = [
  { type: "function", name: "transfer", stateMutability: "nonpayable",
    inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable",
    inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "allowance", stateMutability: "view",
    inputs: [{ type: "address" }, { type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

const POOL_ABI = [
  { type: "function", name: "slot0", stateMutability: "view", inputs: [],
    outputs: [{ type: "uint160" }, { type: "int24" }, { type: "uint16" }, { type: "uint16" }, { type: "uint16" }, { type: "bool" }] },
  { type: "function", name: "token0", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "fee", stateMutability: "view", inputs: [], outputs: [{ type: "uint24" }] },
] as const;

export type Call = { to: Address; data: Hex; value?: bigint };

export type Leg = {
  symbol: string;
  token: Address;
  pool: Address;
  tickSpacing: number;
  /** USDC spent on this leg, raw (6 decimals). */
  amountIn: bigint;
  /** Stock expected at the current pool price after the pool fee, raw (8 decimals). */
  expectedOut: bigint;
  /** What the swap must deliver or revert. */
  minOut: bigint;
  /** USDC per whole share at the pool's spot. */
  priceUsd: number;
  /** Pool fee in hundredths of a bip, as the pool reports it (500 = 0.05%). */
  feePips: number;
};

export type BuyPlan = {
  recipient: Address;
  /** USDC leaving the wallet: the swaps plus the fee. */
  totalIn: bigint;
  /** The fee leg, raw USDC; 0n when no fee is configured. */
  feeIn: bigint;
  feeBps: number;
  legs: Leg[];
  calls: Call[];
  deadline: bigint;
  slippageBps: number;
};

const bigMulDiv = (a: bigint, num: bigint, den: bigint) => (a * num) / den;

/**
 * The expected fill for one leg at the current spot, from slot0. Fine for the sizes we
 * trade against these pools (tens of dollars into millions of liquidity), where price
 * impact is far below the slippage allowance; a tick-walking quoter comes when it matters.
 */
// A pool's address and token order never change, so they are looked up once per session.
// Only slot0 (the price) is read every time.
const poolCache = new Map<string, { address: Address; tickSpacing: number; usdcIsToken0: boolean; fee: number }>();

export async function quoteLeg(symbol: string, amountIn: bigint, client = basePublicClient()): Promise<Omit<Leg, "minOut">> {
  const token = findBySymbol(symbol);
  if (!token?.address) throw new Error(`quoteLeg: ${symbol} has no address`);

  let cached = poolCache.get(token.symbol);
  if (!cached) {
    const pool = await findPool(USDC_BASE, token.address as Address, client);
    if (!pool) throw new Error(`quoteLeg: no Slipstream pool for ${symbol}/USDC`);
    const [token0, fee] = await client.multicall({
      contracts: [
        { address: pool.address, abi: POOL_ABI, functionName: "token0" },
        { address: pool.address, abi: POOL_ABI, functionName: "fee" },
      ],
      allowFailure: false,
    });
    cached = { address: pool.address, tickSpacing: pool.tickSpacing, usdcIsToken0: token0.toLowerCase() === USDC_BASE.toLowerCase(), fee: Number(fee) };
    poolCache.set(token.symbol, cached);
  }
  const pool = cached;
  const { usdcIsToken0, fee } = cached;
  const slot0 = await client.readContract({ address: pool.address, abi: POOL_ABI, functionName: "slot0" });
  const sqrtPriceX96 = slot0[0];
  const Q96 = 2n ** 96n;
  // amountOut = amountIn * price, with price = token1/token0 raw = (sqrtP/Q96)^2.
  const afterFee = amountIn - bigMulDiv(amountIn, BigInt(fee), 1_000_000n);
  const expectedOut = usdcIsToken0
    ? (afterFee * sqrtPriceX96 * sqrtPriceX96) / (Q96 * Q96) // stock is token1: out = in * P
    : (afterFee * Q96 * Q96) / (sqrtPriceX96 * sqrtPriceX96); // stock is token0: out = in / P
  const stockDec = token.decimals ?? 8;
  const priceUsd = Number(amountIn) / 1e6 / (Number(expectedOut) / 10 ** stockDec) * (1 - Number(fee) / 1_000_000);
  return {
    symbol: token.symbol, token: token.address as Address, pool: pool.address, tickSpacing: pool.tickSpacing,
    amountIn, expectedOut, priceUsd, feePips: fee,
  };
}

/**
 * The full plan for buying a basket: USDC amounts per leg from the weights, quotes, and
 * the calldata. `usd` is the total to spend; weights must sum to 100.
 */
export async function planBuy(opts: {
  recipient: Address;
  usd: number;
  picks: { symbol: string; weight: number }[];
  slippageBps?: number;
  /** Override for tests; defaults to Long's treasury and fee. `feeBps: 0` disables the leg. */
  fee?: { recipient: Address; bps: number };
  client?: ReturnType<typeof basePublicClient>;
  now?: number;
}): Promise<BuyPlan> {
  const { recipient, usd, picks, slippageBps = 100, fee = { recipient: TREASURY, bps: FEE_BPS }, client = basePublicClient(), now = Date.now() } = opts;
  const totalIn = parseUnits(usd.toFixed(6), 6);
  // The fee comes off the top; the stocks share the rest by weight, and the rounding
  // dust goes to the first leg so everything sums to the total.
  const feeIn = fee.bps > 0 ? bigMulDiv(totalIn, BigInt(fee.bps), 10_000n) : 0n;
  const swapIn = totalIn - feeIn;
  const amounts = picks.map((p) => bigMulDiv(swapIn, BigInt(p.weight), 100n));
  amounts[0] = (amounts[0] ?? 0n) + (swapIn - amounts.reduce((a, b) => a + b, 0n));

  const legs: Leg[] = await Promise.all(picks.map(async (p, i) => {
    const q = await quoteLeg(p.symbol, amounts[i]!, client);
    return { ...q, minOut: q.expectedOut - bigMulDiv(q.expectedOut, BigInt(slippageBps), 10_000n) };
  }));

  const deadline = BigInt(Math.floor(now / 1000) + 10 * 60);
  const calls: Call[] = [
    { to: USDC_BASE, data: encodeFunctionData({ abi: ERC20_ABI, functionName: "approve", args: [SWAP_ROUTER, swapIn] }) },
    ...(feeIn > 0n ? [{ to: USDC_BASE as Address, data: encodeFunctionData({ abi: ERC20_ABI, functionName: "transfer", args: [fee.recipient, feeIn] }) }] : []),
    ...legs.map((l) => ({
      to: SWAP_ROUTER as Address,
      data: encodeFunctionData({ abi: ROUTER_ABI, functionName: "exactInputSingle", args: [{
        tokenIn: USDC_BASE, tokenOut: l.token, tickSpacing: l.tickSpacing, recipient,
        deadline, amountIn: l.amountIn, amountOutMinimum: l.minOut, sqrtPriceLimitX96: 0n,
      }] }),
    })),
  ];
  return { recipient, totalIn, feeIn, feeBps: fee.bps, legs, calls, deadline, slippageBps };
}

export type SellLeg = {
  symbol: string;
  token: Address;
  pool: Address;
  tickSpacing: number;
  /** Stock sold on this leg, raw (8 decimals). */
  amountIn: bigint;
  /** USDC expected at the current pool price after the pool fee, raw (6 decimals). */
  expectedOut: bigint;
  minOut: bigint;
  priceUsd: number;
  feePips: number;
};

export type SellPlan = { recipient: Address; legs: SellLeg[]; calls: Call[]; expectedOut: bigint; deadline: bigint; slippageBps: number };

/** The expected USDC for selling `amountIn` of a stock at the current spot, from slot0. */
export async function quoteSellLeg(symbol: string, amountIn: bigint, client = basePublicClient()): Promise<Omit<SellLeg, "minOut">> {
  const token = findBySymbol(symbol);
  if (!token?.address) throw new Error(`quoteSellLeg: ${symbol} has no address`);
  // Same pool facts as a buy; quoteLeg fills the cache.
  const q = await quoteLeg(symbol, 1_000_000n, client);
  const cached = poolCache.get(token.symbol)!;
  const slot0 = await client.readContract({ address: cached.address, abi: POOL_ABI, functionName: "slot0" });
  const sqrtPriceX96 = slot0[0];
  const Q96 = 2n ** 96n;
  // Selling the stock: out = in * P when USDC is token1, out = in / P when USDC is token0.
  const gross = cached.usdcIsToken0
    ? (amountIn * Q96 * Q96) / (sqrtPriceX96 * sqrtPriceX96)
    : (amountIn * sqrtPriceX96 * sqrtPriceX96) / (Q96 * Q96);
  const expectedOut = gross - bigMulDiv(gross, BigInt(cached.fee), 1_000_000n);
  return {
    symbol: token.symbol, token: token.address as Address, pool: cached.address, tickSpacing: cached.tickSpacing,
    amountIn, expectedOut, priceUsd: q.priceUsd, feePips: cached.fee,
  };
}

/**
 * Selling part or all of an index: one approval and one exactInputSingle per stock,
 * stock → USDC, in one batch. `units` are whole units per symbol (what the index holds);
 * `fraction` is how much of each to sell (1 = everything). No fee on the way out.
 */
export async function planSell(opts: {
  recipient: Address;
  units: Record<string, number>;
  fraction: number;
  slippageBps?: number;
  client?: ReturnType<typeof basePublicClient>;
  now?: number;
}): Promise<SellPlan> {
  const { recipient, units, fraction, slippageBps = 100, client = basePublicClient(), now = Date.now() } = opts;
  if (!(fraction > 0 && fraction <= 1)) throw new Error("planSell: fraction must be in (0, 1]");
  const entries = Object.entries(units).filter(([, u]) => u > 0);
  const legs: SellLeg[] = await Promise.all(entries.map(async ([symbol, u]) => {
    const dec = findBySymbol(symbol)?.decimals ?? 8;
    // Selling everything must not leave dust behind: round the whole amount, not the fraction.
    const whole = parseUnits(u.toFixed(dec), dec);
    const amountIn = fraction === 1 ? whole : bigMulDiv(whole, BigInt(Math.round(fraction * 10_000)), 10_000n);
    const q = await quoteSellLeg(symbol, amountIn, client);
    return { ...q, minOut: q.expectedOut - bigMulDiv(q.expectedOut, BigInt(slippageBps), 10_000n) };
  }));
  const deadline = BigInt(Math.floor(now / 1000) + 10 * 60);
  const calls: Call[] = legs.flatMap((l) => [
    { to: l.token, data: encodeFunctionData({ abi: ERC20_ABI, functionName: "approve", args: [SWAP_ROUTER, l.amountIn] }) },
    { to: SWAP_ROUTER as Address, data: encodeFunctionData({ abi: ROUTER_ABI, functionName: "exactInputSingle", args: [{
      tokenIn: l.token, tokenOut: USDC_BASE, tickSpacing: l.tickSpacing, recipient,
      deadline, amountIn: l.amountIn, amountOutMinimum: l.minOut, sqrtPriceLimitX96: 0n,
    }] }) },
  ]);
  return { recipient, legs, calls, expectedOut: legs.reduce((a, l) => a + l.expectedOut, 0n), deadline, slippageBps };
}
