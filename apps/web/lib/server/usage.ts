import { db, ensureSchema, hasDatabase } from "./db.ts";

/**
 * Global ceilings on model calls, counted in the database so every serverless instance
 * shares them (the in-memory limiter is per instance and forgets on deploy). Fixed
 * hourly and daily buckets; one upsert per call. Without a database it just says yes and
 * the memory limiter is the only guard.
 *
 * At ~0.02 cents a basket, the daily cap is a few cents of worst case; the real backstop
 * is the credit limit on the OpenRouter key itself.
 */
export const HOURLY = 150;
export const DAILY = 1000;

export async function ensureUsage() {
  await ensureSchema();
  await db()`create table if not exists usage_buckets (
    bucket text primary key,
    count int not null default 0
  )`;
}

export type UsageResult = { ok: true } | { ok: false; retryAfterSec: number; scope: "hour" | "day" };

export async function countModelCall(now = Date.now()): Promise<UsageResult> {
  if (!hasDatabase()) return { ok: true };
  await ensureUsage();
  const hour = Math.floor(now / 3_600_000);
  const day = Math.floor(now / 86_400_000);
  const rows = await db()`
    insert into usage_buckets (bucket, count) values (${"h:" + hour}, 1), (${"d:" + day}, 1)
    on conflict (bucket) do update set count = usage_buckets.count + 1
    returning bucket, count`;
  const h = rows.find((r) => (r.bucket as string).startsWith("h:"))?.count as number;
  const d = rows.find((r) => (r.bucket as string).startsWith("d:"))?.count as number;
  if (d > DAILY) return { ok: false, retryAfterSec: Math.ceil(((day + 1) * 86_400_000 - now) / 1000), scope: "day" };
  if (h > HOURLY) return { ok: false, retryAfterSec: Math.ceil(((hour + 1) * 3_600_000 - now) / 1000), scope: "hour" };
  // Old buckets are tiny rows; sweep the ones from before yesterday now and then.
  if (h % 50 === 0) await db()`delete from usage_buckets where bucket < ${"d:" + (day - 2)} and bucket like 'd:%' or (bucket like 'h:%' and bucket < ${"h:" + (hour - 48)})`;
  return { ok: true };
}
