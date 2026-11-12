"use client";
import { useReadContracts } from "wagmi";
import { formatUnits, type Address } from "viem";
import { getTokens } from "@long/universe";
import { AGGREGATOR_ABI } from "@long/execution";
import { ERC20_ABI } from "@/lib/wallet-balances";

export type Holding = { symbol: string; amount: number; priceUsd: number; valueUsd: number };

/**
 * What a connected wallet actually holds, valued at the Chainlink price. One multicall:
 * balanceOf for every tokenized stock, plus latestRoundData and decimals for each feed.
 * Nothing here is mock — no wallet, no holdings.
 */
export function useHoldings(address?: Address) {
  const tokens = getTokens().filter((t) => t.address && t.chainlinkFeed);
  const contracts = address
    ? [
        ...tokens.map((t) => ({ address: t.address as Address, abi: ERC20_ABI, functionName: "balanceOf", args: [address] }) as const),
        ...tokens.map((t) => ({ address: t.chainlinkFeed as Address, abi: AGGREGATOR_ABI, functionName: "latestRoundData" }) as const),
        ...tokens.map((t) => ({ address: t.chainlinkFeed as Address, abi: AGGREGATOR_ABI, functionName: "decimals" }) as const),
      ]
    : [];
  const { data, isLoading } = useReadContracts({ contracts, query: { enabled: !!address, refetchInterval: 30_000 } });

  const n = tokens.length;
  const holdings: Holding[] = [];
  const prices = new Map<string, number>();
  if (data) {
    tokens.forEach((t, i) => {
      const bal = data[i];
      const round = data[n + i];
      const dec = data[2 * n + i];
      const feedDec = dec?.status === "success" ? (dec.result as number) : 8;
      const answer = round?.status === "success" ? (round.result as readonly [bigint, bigint, bigint, bigint, bigint])[1] : 0n;
      const priceUsd = answer > 0n ? Number(answer) / 10 ** feedDec : 0;
      if (priceUsd > 0) prices.set(t.symbol, priceUsd);
      const raw = bal?.status === "success" ? (bal.result as bigint) : 0n;
      const amount = Number(formatUnits(raw, t.decimals ?? 8));
      if (amount > 0) holdings.push({ symbol: t.symbol, amount, priceUsd, valueUsd: amount * priceUsd });
    });
  }
  const totalUsd = holdings.reduce((a, h) => a + h.valueUsd, 0);
  return { holdings, prices, totalUsd, isLoading };
}
