import { getTokens } from "@long/universe";
import { ARGT_BASE, USDC_BASE } from "@long/execution";
import type { Address } from "viem";

/** ERC-20 balanceOf, the only call we need to read holdings. */
export const ERC20_ABI = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

export const USDC_DECIMALS = 6;

/** The contracts to read for a wallet: USDC plus every tokenized stock, in one multicall. */
export function balanceContracts(owner: Address) {
  const tokens = getTokens().filter((t) => t.address);
  const stocks = tokens.map((t) => ({ address: t.address as Address, abi: ERC20_ABI, functionName: "balanceOf", args: [owner] }) as const);
  return {
    usdc: { address: USDC_BASE, abi: ERC20_ABI, functionName: "balanceOf", args: [owner] } as const,
    argt: { address: ARGT_BASE, abi: ERC20_ABI, functionName: "balanceOf", args: [owner] } as const,
    stocks,
    symbols: tokens.map((t) => t.symbol),
    decimals: tokens.map((t) => t.decimals ?? 8),
  };
}
