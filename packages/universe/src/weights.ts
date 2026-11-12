/**
 * Weight rules shared by the AI (which proposes weights), the web app (which lets the
 * user edit them) and the tests. One source of truth so a basket built by the model and
 * one edited by hand obey exactly the same bounds.
 */

export const W_MIN = 5;
export const W_MAX = 50;
/** No single holding above this when the AI proposes weights (Nasdaq-100 style cap). */
export const W_CAP = 35;

export function frontLoadedWeights(n: number): number[] {
  const raw = Array.from({ length: n }, (_, i) => 1 / (1 + i * 0.18));
  const s = raw.reduce((a, b) => a + b, 0);
  const w = raw.map((r) => Math.round((r / s) * 100));
  const diff = 100 - w.reduce((a, b) => a + b, 0);
  if (w.length) w[0] = (w[0] ?? 0) + diff;
  return w;
}

/** Proposed weights: front-loaded by conviction, capped at W_CAP, integers summing to 100. */
export function balancedWeights(n: number): number[] {
  const w = frontLoadedWeights(n);
  const capped = new Set<number>();
  for (let pass = 0; pass < n; pass++) {
    const over = w.findIndex((x, i) => x > W_CAP && !capped.has(i));
    if (over < 0) break;
    w[over] = W_CAP;
    capped.add(over);
    const r = rebalance(w, capped);
    if (!r) break;
    r.forEach((x, i) => (w[i] = x));
  }
  return w;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Scale the unlocked weights so the total is 100, keeping their proportions and every
 * unlocked weight within [W_MIN, W_MAX]. Locked indexes are left untouched.
 * Returns null when no solution exists (e.g. everything is locked).
 */
export function rebalance(ws: number[], fixed: Set<number> = new Set()): number[] | null {
  const free = ws.map((_, i) => i).filter((i) => !fixed.has(i));
  const fixedSum = ws.reduce((a, w, i) => (fixed.has(i) ? a + w : a), 0);
  const target = 100 - fixedSum;
  if (free.length === 0) return fixedSum === 100 ? [...ws] : null;
  if (target < W_MIN * free.length || target > W_MAX * free.length) return null;
  const freeSum = free.reduce((a, i) => a + (ws[i] ?? 0), 0) || 1;
  const out = ws.map((w, i) => (fixed.has(i) ? w : clamp(Math.round((w * target) / freeSum), W_MIN, W_MAX)));
  let diff = target - free.reduce((a, i) => a + (out[i] ?? 0), 0);
  for (let k = 0; diff !== 0 && k < 400; k++) {
    let j = -1;
    for (const i of free) {
      const w = out[i] ?? 0;
      if (diff > 0 ? w < W_MAX : w > W_MIN) if (j < 0 || w > (out[j] ?? 0)) j = i;
    }
    if (j < 0) return null;
    out[j] = (out[j] ?? 0) + Math.sign(diff);
    diff -= Math.sign(diff);
  }
  return out;
}

/** Range the user can drag index `i` to, given the locked slices and the bounds of the others. */
export function dragRange(ws: number[], i: number, locked: Set<number>): [number, number] {
  const lockedSum = ws.reduce((a, w, k) => (locked.has(k) && k !== i ? a + w : a), 0);
  const others = ws.filter((_, k) => k !== i && !locked.has(k)).length;
  return [clamp(100 - lockedSum - W_MAX * others, W_MIN, W_MAX), clamp(100 - lockedSum - W_MIN * others, W_MIN, W_MAX)];
}

/** @deprecated kept for the mock's original behaviour; prefer rebalance(). */
export function normalize(ws: number[], lockIdx = -1): number[] {
  return rebalance(ws, lockIdx >= 0 ? new Set([lockIdx]) : new Set()) ?? ws;
}

/**
 * Index weights the way indices actually do it: proportional to market cap, with no
 * slice above W_CAP (Nasdaq-100 style) and none below W_MIN so a small name still counts.
 * Whatever the cap takes from the giants is spread over the rest in proportion. Cap
 * weighting also keeps the monthly rebalance small: a slice grows with its price, so
 * only the caps and the floors ever need a trade.
 *
 * `caps` are in any consistent unit; the result is integers summing to 100, in the same
 * order as the input.
 */
export function capWeights(caps: number[]): number[] {
  const n = caps.length;
  if (n === 0) return [];
  if (n * W_MIN > 100 || n * W_CAP < 100) throw new Error(`capWeights: ${n} picks cannot fit within [${W_MIN}, ${W_CAP}]`);
  const out = new Array<number>(n).fill(0);
  const fixed = new Set<number>();
  // Pin whichever slice breaks a bound, redistribute the rest, repeat until nothing moves.
  for (let pass = 0; pass <= n; pass++) {
    const free = caps.map((_, i) => i).filter((i) => !fixed.has(i));
    const target = 100 - [...fixed].reduce((a, i) => a + (out[i] ?? 0), 0);
    const freeCap = free.reduce((a, i) => a + Math.max(caps[i] ?? 0, 0), 0);
    for (const i of free) out[i] = freeCap > 0 ? ((Math.max(caps[i] ?? 0, 0)) / freeCap) * target : target / free.length;
    const over = free.find((i) => (out[i] ?? 0) > W_CAP);
    const under = free.find((i) => (out[i] ?? 0) < W_MIN);
    if (over !== undefined) { out[over] = W_CAP; fixed.add(over); continue; }
    if (under !== undefined) { out[under] = W_MIN; fixed.add(under); continue; }
    break;
  }
  // Largest-remainder rounding, so the integers still sum to 100 and stay within bounds.
  const floors = out.map((w) => Math.floor(w));
  let left = 100 - floors.reduce((a, b) => a + b, 0);
  const order = out.map((w, i) => ({ i, r: w - Math.floor(w) })).sort((a, b) => b.r - a.r);
  for (const { i } of order) {
    if (left <= 0) break;
    if ((floors[i] ?? 0) < W_CAP) { floors[i] = (floors[i] ?? 0) + 1; left--; }
  }
  return floors;
}
