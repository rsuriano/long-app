/**
 * Reads the two price sources for the tokenized stocks on Base, live. No key, no gas.
 *   pnpm --filter @long/execution try
 */
import { getTokens, findBySymbol } from "@long/universe";
import { basePublicClient } from "../src/client.ts";
import { readPrices } from "../src/prices.ts";
import { poolPrice } from "../src/quote.ts";

const client = basePublicClient();

console.log("=== Chainlink (precio de referencia) ===");
const prices = await readPrices(getTokens(), client);
for (const p of prices) {
  const ageMin = Math.round((Date.now() / 1000 - p.updatedAt) / 60);
  console.log(`  ${p.symbol.padEnd(7)} $${p.usd.toFixed(2).padStart(8)}   (hace ${ageMin} min)`);
}

console.log("\n=== Aerodrome (precio spot del pool) ===");
const chainlink = new Map(prices.map((p) => [p.symbol, p.usd]));
for (const t of getTokens()) {
  const p = await poolPrice(t.symbol, client);
  if (!p) { console.log(`  ${t.symbol.padEnd(7)} sin pool`); continue; }
  const cl = chainlink.get(t.symbol);
  const diff = cl ? ` (${(((p.usdcPerToken - cl) / cl) * 100 >= 0 ? "+" : "")}${(((p.usdcPerToken - cl) / cl) * 100).toFixed(1)}% vs Chainlink)` : "";
  console.log(`  ${t.symbol.padEnd(7)} $${p.usdcPerToken.toFixed(2).padStart(8)}   ts${p.tickSpacing}${diff}`);
}
