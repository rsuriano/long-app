/**
 * Records a purchase that already happened on Base into the database, verified against
 * the chain exactly like the API does. For backfills and support.
 *
 *   DATABASE_URL=... pnpm --filter @long/web record <owner> <tx> "<name>" <usd> TSLAc:35 NVDAc:35 SPCXc:30
 *   pnpm --filter @long/web record 0xbDB5... 0xb283... "Everything Elon" 2 TSLAc:29 NVDAc:31 SPCXc:40
 */
import type { Address, Hex } from "viem";
import { listForOwner, savePurchase } from "../lib/server/purchases.ts";

const [owner, tx, name, usdArg, ...pickArgs] = process.argv.slice(2);
if (!owner || !tx || !name || !usdArg || pickArgs.length < 3) {
  console.error('usage: record <owner> <tx> "<name>" <usd> SYMc:weight ...');
  process.exit(1);
}
const picks = pickArgs.map((p) => p.split(":")[0]!);
const weights = pickArgs.map((p) => Number(p.split(":")[1] ?? 0));
const saved = await savePurchase({ owner: owner as Address, tx: tx as Hex, name, picks, weights, usd: Number(usdArg) });
console.log("saved", saved.id, saved.name, saved.units, `$${saved.costUsd}`);
const all = await listForOwner(owner);
console.log(`${all.indices.length} index(es), ${all.purchases.length} purchase(s) for this wallet`);
process.exit(0);
