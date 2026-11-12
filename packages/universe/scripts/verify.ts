/**
 * Verifies base.json against Base mainnet: for every token, reads symbol(), name() and
 * decimals() over JSON-RPC and reports mismatches. Read-only, no key needed.
 *
 *   pnpm --filter @long/universe verify
 *   BASE_RPC_URL=https://your-node pnpm --filter @long/universe verify
 *
 * Public RPCs rate-limit hard, so calls are sequential with backoff across several
 * endpoints. Pass BASE_RPC_URL (Alchemy, Infura, CDP) to make it fast and reliable.
 * Exit code is non-zero if any token fails, so CI can gate on it.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const registry = JSON.parse(readFileSync(join(here, "..", "base.json"), "utf8"));

const RPCS = process.env.BASE_RPC_URL
  ? [process.env.BASE_RPC_URL]
  : ["https://mainnet.base.org", "https://base.llamarpc.com", "https://base-rpc.publicnode.com"];

const SYMBOL = "0x95d89b41";
const NAME = "0x06fdde03";
const DECIMALS = "0x313ce567";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function call(to: string, data: string): Promise<string> {
  let last: unknown;
  for (let attempt = 0; attempt < 9; attempt++) {
    const rpc = RPCS[attempt % RPCS.length]!;
    try {
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }),
      });
      const json = (await res.json()) as { result?: string; error?: { message: string } };
      if (json.error) throw new Error(json.error.message);
      if (!json.result) throw new Error("empty result");
      return json.result;
    } catch (e) {
      last = e;
      await sleep(600 * (attempt + 1));
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

/** Decodes an ABI-encoded string return value. */
function decodeString(hex: string): string {
  const raw = hex.slice(2);
  const len = parseInt(raw.slice(64, 128), 16);
  return Buffer.from(raw.slice(128, 128 + len * 2), "hex").toString("utf8");
}

type Token = { symbol: string; address: string | null; addressHint: string | null; decimals: number | null; onchainName?: string };

let failures = 0;
for (const t of registry.tokens as Token[]) {
  if (!t.address) {
    console.log(`SKIP ${t.symbol.padEnd(7)} no address (hint ${t.addressHint ?? "none"})`);
    failures++;
    continue;
  }
  try {
    const symbol = decodeString(await call(t.address, SYMBOL));
    await sleep(300);
    const name = decodeString(await call(t.address, NAME));
    await sleep(300);
    const decimals = parseInt(await call(t.address, DECIMALS), 16);
    await sleep(300);

    const problems: string[] = [];
    if (symbol !== t.symbol) problems.push(`symbol is ${symbol}`);
    if (t.decimals !== null && decimals !== t.decimals) problems.push(`decimals are ${decimals}, registry says ${t.decimals}`);
    if (t.onchainName && name !== t.onchainName) problems.push(`name is ${name}`);

    if (problems.length) {
      failures++;
      console.log(`FAIL ${t.symbol.padEnd(7)} ${t.address}: ${problems.join("; ")}`);
    } else {
      console.log(`OK   ${t.symbol.padEnd(7)} ${t.address}  ${decimals}d  ${name}`);
    }
  } catch (e) {
    failures++;
    console.log(`ERR  ${t.symbol.padEnd(7)} ${t.address}: ${(e as Error).message}`);
  }
}

console.log(failures ? `\n${failures} of ${registry.tokens.length} failed` : `\nAll ${registry.tokens.length} tokens match Base mainnet`);
process.exit(failures ? 1 : 0);
