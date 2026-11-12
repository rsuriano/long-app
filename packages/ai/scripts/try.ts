/**
 * Runs real prompts through the configured model and prints the baskets.
 *
 *   pnpm --filter @long/ai try
 *   pnpm --filter @long/ai try "AI without Zuckerberg"
 *   LONG_AI_MODEL=qwen/qwen3.7-flash pnpm --filter @long/ai try
 *
 * Reads OPENROUTER_API_KEY from .env at the repo root. Never prints the key.
 */
import { findBySymbol } from "@long/universe";
import { promptToBasket } from "../src/index.ts";

const PROMPTS = [
  "AI without Zuckerberg",
  "Mag 7 minus Tesla",
  "Everything Elon",
  "Companies my mom uses",
  "Cloud, no ads",
  "The AI data center",
  "Latin America, listed in New York",
  "quiero apostar a los robots pero sin Tesla",
];

const args = process.argv.slice(2);
const prompts = args.length ? args : PROMPTS;

if (!process.env.OPENROUTER_API_KEY) {
  console.error("No OPENROUTER_API_KEY. Add it to .env at the repo root, then rerun.");
  process.exit(1);
}

let clean = 0;
for (const p of prompts) {
  const r = await promptToBasket(p);
  const tag = { model: "OK   ", repair: "FIX  ", fallback: "FALL " }[r.source];
  if (r.source === "model") clean++;
  console.log(`\n${tag} "${p}"  ·  ${r.ms}ms · ${r.attempts} call(s) · ${r.model}`);
  console.log(`  ${r.basket.name}`);
  console.log(
    "  " +
      r.basket.picks.map((x) => `${findBySymbol(x.symbol)?.ticker ?? x.symbol} ${x.weight}%`).join("  ")
  );
  if (r.basket.excluded.length) {
    console.log("  minus " + r.basket.excluded.map((e) => `${findBySymbol(e.symbol)?.ticker ?? e.symbol} (${e.reason})`).join(", "));
  }
  console.log(`  "${r.basket.note}"`);
  if (r.problems.length) console.log("  problems: " + r.problems.join("; "));
}
console.log(`\n${clean}/${prompts.length} clean on the first call`);
