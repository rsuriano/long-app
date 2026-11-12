/**
 * Simulates a real buy with eth_call and a state override that pretends the account holds
 * and approved the USDC, so the exact calldata the wallet will sign is checked against the
 * live pool, for free, before anyone signs anything.
 *
 *   pnpm --filter @long/execution dry-run            # $5 of NVDAc
 *   pnpm --filter @long/execution dry-run 10 NVDAc:35 TSLAc:35 SPCXc:30
 */
import { decodeFunctionResult, encodeAbiParameters, keccak256, pad, toHex, formatUnits, type Address, type Hex } from "viem";
import { basePublicClient, USDC_BASE } from "../src/client.ts";
import { planBuy, ROUTER_ABI, SWAP_ROUTER } from "../src/swap.ts";

const [usdArg, ...pickArgs] = process.argv.slice(2);
const usd = Number(usdArg ?? 5);
const picks = pickArgs.length
  ? pickArgs.map((p) => { const [symbol, w] = p.split(":"); return { symbol: symbol!, weight: Number(w ?? 100) }; })
  : [{ symbol: "NVDAc", weight: 100 }];

const client = basePublicClient();
const account = "0x1111111111111111111111111111111111111111" as Address; // nobody; only exists in the override

const plan = await planBuy({ recipient: account, usd, picks, client });
console.log(`Plan: $${usd} → ${plan.legs.length} leg(s) + fee ${formatUnits(plan.feeIn, 6)} USDC (${plan.feeBps} bps), ${plan.calls.length} calls, slippage ${plan.slippageBps} bps`);
for (const l of plan.legs) {
  console.log(`  ${l.symbol.padEnd(6)} in $${formatUnits(l.amountIn, 6).padStart(9)}  expect ${formatUnits(l.expectedOut, 8)} @ $${l.priceUsd.toFixed(2)}  fee ${l.feePips / 10000}%  pool ${l.pool} ts${l.tickSpacing}`);
}

// FiatToken storage: balances at slot 9, allowed at slot 10 (both mappings).
const slotOf = (key: Address, base: number) => keccak256(encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [key, BigInt(base)]));
const balanceSlot = slotOf(account, 9);
const allowanceSlot = keccak256(encodeAbiParameters([{ type: "address" }, { type: "bytes32" }], [SWAP_ROUTER, slotOf(account, 10)]));
const amount = pad(toHex(plan.totalIn), { size: 32 });
const stateOverride = [{ address: USDC_BASE, stateDiff: [{ slot: balanceSlot, value: amount }, { slot: allowanceSlot, value: amount }] }];

// Approve and the fee transfer come first (they would pass); simulate each swap leg with the override in place.
const first = plan.calls.length - plan.legs.length;
for (const [i, leg] of plan.legs.entries()) {
  const call = plan.calls[first + i]!;
  try {
    const { data } = await client.call({ account, to: call.to, data: call.data, stateOverride });
    const out = decodeFunctionResult({ abi: ROUTER_ABI, functionName: "exactInputSingle", data: data as Hex });
    const dev = (Number(out - leg.expectedOut) / Number(leg.expectedOut)) * 100;
    console.log(`  OK   ${leg.symbol} fill ${formatUnits(out, 8)} (${dev >= 0 ? "+" : ""}${dev.toFixed(3)}% vs expected, min ${formatUnits(leg.minOut, 8)})`);
  } catch (e) {
    console.log(`  FAIL ${leg.symbol}: ${String((e as Error).message).split("\n").slice(0, 4).join(" | ").slice(0, 400)}`);
  }
}
