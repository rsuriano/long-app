/**
 * Fixed-window limiter for the one route that costs money on every call.
 *
 * In memory: per instance and forgotten on deploy, which is fine for the per-IP burst
 * check it does first. The global hourly and daily ceilings that actually protect the
 * model credit are counted in the database (lib/server/usage.ts), shared by every
 * instance. Together they stop a bored person with curl and a small botnet alike; the
 * credit limit on the model key is the last line.
 */
type Window = { count: number; resetAt: number };

const buckets = new Map<string, Window>();

export type Limit = { limit: number; windowMs: number };

/** Per caller, and a global ceiling so one bad afternoon cannot drain the model credit. */
export const PER_IP: Limit = { limit: 8, windowMs: 10 * 60_000 };
export const GLOBAL: Limit = { limit: 120, windowMs: 60 * 60_000 };

export type RateResult = { ok: true } | { ok: false; retryAfterSec: number; scope: "ip" | "global" };

function hit(key: string, { limit, windowMs }: Limit, now: number): { ok: boolean; retryAfterSec: number } {
  const w = buckets.get(key);
  if (!w || now >= w.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }
  w.count++;
  if (w.count > limit) return { ok: false, retryAfterSec: Math.ceil((w.resetAt - now) / 1000) };
  return { ok: true, retryAfterSec: 0 };
}

/** Keeps the map from growing without bound on a long-lived instance. */
function sweep(now: number) {
  if (buckets.size < 5000) return;
  for (const [k, w] of buckets) if (now >= w.resetAt) buckets.delete(k);
}

export function checkRateLimit(ip: string, now = Date.now()): RateResult {
  sweep(now);
  const global = hit("__global__", GLOBAL, now);
  if (!global.ok) return { ok: false, retryAfterSec: global.retryAfterSec, scope: "global" };
  const perIp = hit(`ip:${ip}`, PER_IP, now);
  if (!perIp.ok) return { ok: false, retryAfterSec: perIp.retryAfterSec, scope: "ip" };
  return { ok: true };
}

/**
 * Behind Vercel or Caddy the socket address is the proxy, so read the forwarded headers.
 * Only the first hop is trusted; the rest of the chain is client-controlled.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}

/** Tests only: forget every window. */
export function resetRateLimit() {
  buckets.clear();
}
