import { parseAbiItem, type Address, type Hex } from "viem";
import { findBySymbol } from "@long/universe";
import { basePublicClient } from "@long/execution";
import { db, ensureSchema } from "./db.ts";
import { savePurchase } from "./purchases.ts";

/**
 * A purchase is recorded by the browser after the wallet confirms it. If the browser
 * dies in between (app closed, tab killed), the stocks arrive but nothing is written.
 * So before asking for the signature the browser leaves an intent here — what it is
 * about to buy — and the server reconciles: any pending intent is matched against the
 * stock Transfers that reached the wallet since, and recorded from the chain.
 */
export type Intent = { id: number; owner: string; name: string; picks: string[]; weights: number[]; usd: number; fromBlock: bigint; at: Date };

export async function ensureIntents() {
  await ensureSchema();
  await db()`create table if not exists intents (
    id bigserial primary key,
    owner text not null,
    name text not null,
    picks jsonb not null,
    weights jsonb not null,
    usd numeric not null,
    from_block bigint not null,
    at timestamptz not null default now(),
    done_tx text
  )`;
  await db()`create index if not exists intents_owner_pending on intents (owner) where done_tx is null`;
}

export async function createIntent(p: { owner: Address; name: string; picks: string[]; weights: number[]; usd: number }) {
  await ensureIntents();
  const block = await basePublicClient().getBlockNumber();
  const rows = await db()`insert into intents (owner, name, picks, weights, usd, from_block)
    values (${p.owner.toLowerCase()}, ${p.name}, ${db().json(p.picks)}, ${db().json(p.weights)}, ${p.usd}, ${block.toString()})
    returning id`;
  return { id: Number(rows[0]!.id), fromBlock: block };
}

const TRANSFER = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");
const MAX_LOOKBACK = 60_000n; // ~33 hours of Base blocks
const CHUNK = 4_000n;

/**
 * Records what pending intents can be proven on-chain. Cheap when there is nothing
 * pending (one query); otherwise a few log reads. Never throws: a failure here only
 * means the record waits for the next call.
 */
export async function reconcile(owner: string): Promise<number> {
  await ensureIntents();
  const q = db();
  const o = owner.toLowerCase();
  const pending = (await q`select * from intents where owner = ${o} and done_tx is null and at < now() - interval '45 seconds' order by at asc`)
    .map((r) => ({ id: Number(r.id), owner: o, name: r.name as string, picks: r.picks as string[], weights: r.weights as number[], usd: Number(r.usd), fromBlock: BigInt(r.from_block as string), at: r.at as Date }));
  // Nothing to do, or too old to keep looking: forget it.
  await q`delete from intents where owner = ${o} and done_tx is null and at < now() - interval '30 hours'`;
  if (pending.length === 0) return 0;

  const client = basePublicClient();
  const head = await client.getBlockNumber();
  const from = pending.reduce((a, i) => (i.fromBlock < a ? i.fromBlock : a), head);
  const start = from > head - MAX_LOOKBACK ? from : head - MAX_LOOKBACK;
  const tokens = [...new Set(pending.flatMap((i) => i.picks))].map((s) => findBySymbol(s)?.address).filter(Boolean) as Address[];
  const symbolOf = new Map<string, string>();
  for (const s of new Set(pending.flatMap((i) => i.picks))) { const t = findBySymbol(s); if (t?.address) symbolOf.set(t.address.toLowerCase(), t.symbol); }

  // Every stock transfer into this wallet since the earliest intent, grouped by tx.
  const txs = new Map<Hex, { symbols: Set<string>; block: bigint }>();
  for (let b = start; b <= head; b += CHUNK) {
    const to = b + CHUNK - 1n < head ? b + CHUNK - 1n : head;
    const logs = await client.getLogs({ address: tokens, event: TRANSFER, args: { to: owner as Address }, fromBlock: b, toBlock: to });
    for (const l of logs) {
      const entry = txs.get(l.transactionHash) ?? { symbols: new Set<string>(), block: l.blockNumber };
      entry.symbols.add(symbolOf.get(l.address.toLowerCase()) ?? "");
      txs.set(l.transactionHash, entry);
    }
  }
  const recorded = new Set((await q`select tx from purchases where owner = ${o}`).map((r) => r.tx as string));
  const candidates = [...txs.entries()].filter(([tx]) => !recorded.has(tx)).sort((a, b) => (a[1].block < b[1].block ? -1 : 1));

  let done = 0;
  for (const intent of pending) {
    const hit = candidates.find(([, v]) => intent.picks.every((s) => v.symbols.has(s)) && v.block >= intent.fromBlock);
    if (!hit) continue;
    const [tx] = hit;
    try {
      await savePurchase({ owner: owner as Address, tx, name: intent.name, picks: intent.picks, weights: intent.weights, usd: intent.usd });
      await q`update intents set done_tx = ${tx} where id = ${intent.id}`;
      candidates.splice(candidates.indexOf(hit), 1);
      done++;
    } catch (e) {
      console.error("reconcile:", (e as Error).message);
    }
  }
  return done;
}

/** The browser did record it: close the intent so it is not matched again. */
export async function settleIntent(owner: string, name: string, tx: string) {
  await ensureIntents();
  await db()`update intents set done_tx = ${tx} where id = (
    select id from intents where owner = ${owner.toLowerCase()} and done_tx is null and name = ${name} order by at desc limit 1)`;
}
