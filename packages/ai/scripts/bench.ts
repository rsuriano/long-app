/**
 * Compares models on the prompts the product actually gets: how often the first answer is
 * valid, how long the person waits, and what it costs. Model choice is a demo-day decision
 * (docs/long-plan.md), so keep this runnable rather than trusting one afternoon's result.
 *
 *   pnpm --filter @long/ai bench
 *   pnpm --filter @long/ai bench deepseek/deepseek-v4-flash qwen/qwen3.7-flash
 *
 * Every prompt runs against every model. Costs pennies; prints a table.
 */
import { openRouterClient } from "../src/client.ts";
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

const DEFAULT_MODELS = [
  "deepseek/deepseek-v4-flash",
  "qwen/qwen3.7-flash",
  "qwen/qwen3-30b-a3b-instruct-2507",
  "qwen/qwen3-32b",
  "z-ai/glm-4.7-flash",
];

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error("No OPENROUTER_API_KEY. Add it to .env at the repo root, then rerun.");
  process.exit(1);
}

const models = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_MODELS;
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2]! : Math.round(((s[s.length / 2 - 1]! + s[s.length / 2]!) / 2));
};

type Row = { model: string; clean: number; repaired: number; failed: number; p50: number; worst: number; notes: string[] };
const rows: Row[] = [];

for (const model of models) {
  const client = openRouterClient({ apiKey, model });
  const times: number[] = [];
  const notes: string[] = [];
  let clean = 0, repaired = 0, failed = 0;

  // Sequential: a shared rate limit would distort the latency we are trying to measure.
  for (const prompt of PROMPTS) {
    const r = await promptToBasket(prompt, { client });
    times.push(r.ms);
    if (r.source === "model") clean++;
    else if (r.source === "repair") repaired++;
    else {
      failed++;
      notes.push(`${prompt}: ${r.problems.at(-1)?.slice(0, 80) ?? "?"}`);
    }
  }
  rows.push({ model, clean, repaired, failed, p50: median(times), worst: Math.max(...times), notes });
  console.log(`${model.padEnd(34)} clean ${clean}/${PROMPTS.length}  repaired ${repaired}  failed ${failed}  p50 ${median(times)}ms  worst ${Math.max(...times)}ms`);
}

console.log(`\n${"model".padEnd(34)} ${"clean".padStart(6)} ${"fixed".padStart(6)} ${"fail".padStart(5)} ${"p50".padStart(8)} ${"worst".padStart(8)}`);
for (const r of rows.sort((a, b) => b.clean - a.clean || a.p50 - b.p50)) {
  console.log(`${r.model.padEnd(34)} ${`${r.clean}/${PROMPTS.length}`.padStart(6)} ${String(r.repaired).padStart(6)} ${String(r.failed).padStart(5)} ${`${r.p50}ms`.padStart(8)} ${`${r.worst}ms`.padStart(8)}`);
}
for (const r of rows) for (const n of r.notes) console.log(`  ${r.model}: ${n}`);
