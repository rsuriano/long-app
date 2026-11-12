/**
 * Runs every prompt the app offers by itself (the chips and the curated list) through the
 * model once, and commits the result. Those become instant and free for everyone.
 *
 *   pnpm --filter @long/web precompute
 *
 * Rerun when the universe changes, the prompt changes, or the model changes. The output
 * records which universe it describes so a stale file is ignored instead of served.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getUniverse, type Basket } from "@long/universe";
import { promptToBasket } from "@long/ai";
import { CURATED, SUGGEST } from "../lib/mock-data.ts";
import { normalizePrompt } from "../lib/normalize-prompt.ts";

if (!process.env.OPENROUTER_API_KEY) {
  console.error("No OPENROUTER_API_KEY. Add it to .env at the repo root, then rerun.");
  process.exit(1);
}

const prompts = [...new Set([...SUGGEST, ...CURATED.map((c) => c.prompt)])];
const baskets: Record<string, Basket> = {};
let model = "unknown";
let failed = 0;

for (const prompt of prompts) {
  const r = await promptToBasket(prompt);
  model = r.model;
  if (r.source === "fallback") {
    failed++;
    console.log(`SKIP  ${prompt} — ${r.problems.at(-1)?.slice(0, 80)}`);
    continue; // never commit a template as if the model had answered
  }
  baskets[normalizePrompt(prompt)] = r.basket;
  console.log(`OK    ${prompt} → ${r.basket.name} (${r.ms}ms, ${r.source})`);
}

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "baskets.json");
writeFileSync(
  out,
  JSON.stringify(
    { universeUpdatedAt: getUniverse().updatedAt, model, generatedAt: new Date().toISOString().slice(0, 10), baskets },
    null,
    2,
  ) + "\n",
);
console.log(`\n${Object.keys(baskets).length}/${prompts.length} guardadas en ${out}`);
if (failed) console.log(`${failed} fallaron y quedaron fuera; volvé a correrlo para completarlas`);
