import { decodeEventLog, erc20Abi, formatUnits, type Address, type Hex } from "viem";
import { findBySymbol } from "@long/universe";
import { basePublicClient, USDC_BASE } from "@long/execution";
import { db, ensureSchema } from "./db.ts";

export type IndexRow = {
  id: string; owner: string; name: string; picks: string[]; weights: number[];
  units: Record<string, number>; costUsd: number; tx: string; createdAt: string; updatedAt: string;
};
export type PurchaseRow = { tx: string; owner: string; indexId: string; name: string; kind: "buy" | "add" | "sell"; usd: number; units: Record<string, number>; at: string };

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "index";

/**
 * The units a transaction actually delivered to `owner`, per stock, read from the
 * receipt. This is what makes the record trustworthy without a login: nobody can save a
 * purchase that did not happen, and the units are the chain's, not the client's.
 */
export async function unitsFromChain(tx: Hex, owner: Address, picks: string[]) {
  const client = basePublicClient();
  const receipt = await client.getTransactionReceipt({ hash: tx });
  if (receipt.status !== "success") throw new Error("that transaction failed");
  const bySymbol: Record<string, number> = {};
  for (const symbol of picks) {
    const t = findBySymbol(symbol);
    if (!t?.address) throw new Error(`unknown stock ${symbol}`);
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== t.address.toLowerCase()) continue;
      try {
        const ev = decodeEventLog({ abi: erc20Abi, topics: log.topics, data: log.data });
        if (ev.eventName === "Transfer" && ev.args.to.toLowerCase() === owner.toLowerCase()) {
          bySymbol[t.symbol] = (bySymbol[t.symbol] ?? 0) + Number(formatUnits(ev.args.value, t.decimals ?? 8));
        }
      } catch {
        // another event on the token
      }
    }
  }
  if (Object.keys(bySymbol).length === 0) throw new Error("that transaction sent no stocks to this wallet");
  return bySymbol;
}

export async function listForOwner(owner: string): Promise<{ indices: IndexRow[]; purchases: PurchaseRow[] }> {
  await ensureSchema();
  const q = db();
  const o = owner.toLowerCase();
  const rows = await q`
    select i.*, (select p.tx from purchases p where p.index_id = i.id order by p.at desc limit 1) as tx
    from indices i where i.owner = ${o} and i.units <> '{}'::jsonb order by i.created_at desc`;
  const ps = await q`select p.*, i.name from purchases p join indices i on i.id = p.index_id where p.owner = ${o} order by p.at desc limit 200`;
  return {
    indices: rows.map((r) => ({
      id: r.id as string, owner: r.owner as string, name: r.name as string, picks: r.picks as string[], weights: r.weights as number[],
      units: r.units as Record<string, number>, costUsd: Number(r.cost_usd), tx: (r.tx as string) ?? "",
      createdAt: (r.created_at as Date).toISOString(), updatedAt: (r.updated_at as Date).toISOString(),
    })),
    purchases: ps.map((p) => ({
      tx: p.tx as string, owner: p.owner as string, indexId: p.index_id as string, name: p.name as string, kind: p.kind as "buy" | "add" | "sell",
      usd: Number(p.usd), units: p.units as Record<string, number>, at: (p.at as Date).toISOString(),
    })).map((p) => ({ ...p, kind: p.kind as "buy" | "add" | "sell" })),
  };
}

/** Saves a verified purchase: into an existing index (`indexId`) or as a new one. Idempotent by tx. */
export async function savePurchase(p: {
  owner: Address; tx: Hex; indexId?: string; name: string; picks: string[]; weights: number[]; usd: number;
}): Promise<IndexRow> {
  await ensureSchema();
  const q = db();
  const owner = p.owner.toLowerCase();
  const units = await unitsFromChain(p.tx, p.owner, p.picks);

  return q.begin(async (t) => {
    const dup = await t`select index_id from purchases where tx = ${p.tx}`;
    let id = dup[0]?.index_id as string | undefined;
    if (!id) {
      const existing = p.indexId ? await t`select id from indices where id = ${p.indexId} and owner = ${owner}` : [];
      if (existing[0]) {
        id = existing[0].id as string;
        await t`update indices set
          units = (select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from (
            select k, sum(v::numeric) as v from (
              select key as k, value::text as v from jsonb_each(units)
              union all select key, value::text from jsonb_each(${t.json(units)}::jsonb)
            ) m group by k) s),
          cost_usd = cost_usd + ${p.usd}, updated_at = now()
          where id = ${id}`;
      } else {
        const base = `${slug(p.name)}-${owner.slice(2, 8)}`;
        id = base;
        for (let n = 2; (await t`select 1 from indices where id = ${id}`).length; n++) id = `${base}-${n}`;
        await t`insert into indices (id, owner, name, picks, weights, units, cost_usd)
          values (${id}, ${owner}, ${p.name}, ${t.json(p.picks)}, ${t.json(p.weights)}, ${t.json(units)}, ${p.usd})`;
      }
      await t`insert into purchases (tx, owner, index_id, kind, usd, units)
        values (${p.tx}, ${owner}, ${id}, ${existing[0] ? "add" : "buy"}, ${p.usd}, ${t.json(units)})`;
    }
    const row = (await t`select * from indices where id = ${id}`)[0]!;
    return {
      id: row.id as string, owner: row.owner as string, name: row.name as string, picks: row.picks as string[], weights: row.weights as number[],
      units: row.units as Record<string, number>, costUsd: Number(row.cost_usd), tx: p.tx,
      createdAt: (row.created_at as Date).toISOString(), updatedAt: (row.updated_at as Date).toISOString(),
    };
  }) as Promise<IndexRow>;
}

/**
 * A sale, verified the same way: the stocks that left the wallet in that transaction
 * (Transfer from owner) and the USDC that came back. Units come off the index; the cost
 * basis comes down in proportion. An index sold to dust is removed.
 */
export async function saleFromChain(tx: Hex, owner: Address, picks: string[]) {
  const client = basePublicClient();
  const receipt = await client.getTransactionReceipt({ hash: tx });
  if (receipt.status !== "success") throw new Error("that transaction failed");
  const sold: Record<string, number> = {};
  let usdc = 0;
  for (const log of receipt.logs) {
    try {
      const ev = decodeEventLog({ abi: erc20Abi, topics: log.topics, data: log.data });
      if (ev.eventName !== "Transfer") continue;
      const addr = log.address.toLowerCase();
      if (addr === USDC_BASE.toLowerCase() && ev.args.to.toLowerCase() === owner.toLowerCase()) usdc += Number(formatUnits(ev.args.value, 6));
      const t = picks.map((s) => findBySymbol(s)).find((t) => t?.address?.toLowerCase() === addr);
      if (t && ev.args.from.toLowerCase() === owner.toLowerCase()) sold[t.symbol] = (sold[t.symbol] ?? 0) + Number(formatUnits(ev.args.value, t.decimals ?? 8));
    } catch {
      // not a transfer
    }
  }
  if (Object.keys(sold).length === 0) throw new Error("that transaction sold no stocks from this wallet");
  return { sold, usdc };
}

export async function saveSale(p: { owner: Address; tx: Hex; indexId: string }): Promise<IndexRow | null> {
  await ensureSchema();
  const q = db();
  const owner = p.owner.toLowerCase();
  const rows = await q`select * from indices where id = ${p.indexId} and owner = ${owner}`;
  const row = rows[0];
  if (!row) throw new Error("no such index");
  const units = row.units as Record<string, number>;
  const { sold, usdc } = await saleFromChain(p.tx, p.owner, Object.keys(units));

  return q.begin(async (t) => {
    if ((await t`select 1 from purchases where tx = ${p.tx}`).length) return null; // already recorded
    const before = Object.values(units).reduce((a, b) => a + b, 0);
    const next: Record<string, number> = {};
    for (const [s, u] of Object.entries(units)) next[s] = Math.max(0, u - (sold[s] ?? 0));
    const after = Object.values(next).reduce((a, b) => a + b, 0);
    const keep = before > 0 ? after / before : 0;
    const cost = Number(row.cost_usd) * keep;
    await t`insert into purchases (tx, owner, index_id, kind, usd, units) values (${p.tx}, ${owner}, ${p.indexId}, 'sell', ${usdc}, ${t.json(sold)})`;
    if (after * 1e8 < 100) {
      // Sold out: the index is gone, its history stays (purchases keep the id).
      await t`update indices set units = '{}'::jsonb, cost_usd = 0, updated_at = now() where id = ${p.indexId}`;
    } else {
      await t`update indices set units = ${t.json(next)}, cost_usd = ${cost}, updated_at = now() where id = ${p.indexId}`;
    }
    const r = (await t`select * from indices where id = ${p.indexId}`)[0]!;
    return {
      id: r.id as string, owner: r.owner as string, name: r.name as string, picks: r.picks as string[], weights: r.weights as number[],
      units: r.units as Record<string, number>, costUsd: Number(r.cost_usd), tx: p.tx,
      createdAt: (r.created_at as Date).toISOString(), updatedAt: (r.updated_at as Date).toISOString(),
    };
  }) as Promise<IndexRow | null>;
}
