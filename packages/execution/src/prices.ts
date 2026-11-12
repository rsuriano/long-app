import type { Address } from "viem";
import { getTokens, type Token } from "@long/universe";
import { basePublicClient } from "./client.ts";

/** Minimal Chainlink aggregator surface: the price and how stale it is. */
export const AGGREGATOR_ABI = [
  { type: "function", name: "latestRoundData", stateMutability: "view", inputs: [],
    outputs: [
      { name: "roundId", type: "uint80" }, { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" }, { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
] as const;

export type Price = { symbol: string; usd: number; updatedAt: number };

/**
 * Reads the Chainlink total-return price of every token that has a feed, in one multicall.
 * This is the number the app values the portfolio with; the executable price (what a swap
 * actually returns) comes from the Aerodrome quoter instead.
 */
export async function readPrices(tokens: Token[] = getTokens(), client = basePublicClient()): Promise<Price[]> {
  const withFeed = tokens.filter((t) => t.chainlinkFeed);
  const calls = withFeed.flatMap((t) => [
    { address: t.chainlinkFeed as Address, abi: AGGREGATOR_ABI, functionName: "latestRoundData" } as const,
    { address: t.chainlinkFeed as Address, abi: AGGREGATOR_ABI, functionName: "decimals" } as const,
  ]);
  const results = await client.multicall({ contracts: calls, allowFailure: true });

  const prices: Price[] = [];
  for (let i = 0; i < withFeed.length; i++) {
    const token = withFeed[i]!;
    const round = results[i * 2];
    const dec = results[i * 2 + 1];
    if (round?.status !== "success" || dec?.status !== "success") continue;
    const [, answer, , updatedAt] = round.result as readonly [bigint, bigint, bigint, bigint, bigint];
    const decimals = dec.result as number;
    if (answer <= 0n) continue;
    prices.push({ symbol: token.symbol, usd: Number(answer) / 10 ** decimals, updatedAt: Number(updatedAt) });
  }
  return prices;
}
