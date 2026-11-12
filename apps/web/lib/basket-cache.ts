import type { Basket } from "@long/universe";
import { getUniverse } from "@long/universe";
import precomputed from "@/data/baskets.json";
import { normalizePrompt as normalize } from "./normalize-prompt";

/**
 * Two layers in front of the model, because every call costs money and 5-45 seconds.
 *
 *  1. Precomputed: the chips and the curated list are prompts we already know. They were
 *     run through the model once and committed, so they answer instantly and for free.
 *     Regenerate with `pnpm --filter @long/web precompute`.
 *  2. In memory: anything else a person repeats within the life of this instance. Resets
 *     on deploy and is per-instance, like the rate limiter; move both to the DB in Fase 2.
 *
 * A custom prompt nobody has asked before still reaches the model. That is the product.
 */
export type CacheHit = { basket: Basket; layer: "precomputed" | "memory" };

type Entry = { basket: Basket; storedAt: number };

const MAX_ENTRIES = 300;
const TTL_MS = 24 * 60 * 60_000;

const memory = new Map<string, Entry>();

type PrecomputedFile = { universeUpdatedAt: string; model: string; generatedAt: string; baskets: Record<string, Basket> };
const file = precomputed as PrecomputedFile;

/**
 * The committed baskets only hold while they describe the same universe. If Coinbase
 * lists a new stock, they may name a set that is no longer the best answer, so they are
 * dropped wholesale rather than served stale.
 */
const precomputedIsFresh = file.universeUpdatedAt === getUniverse().updatedAt;

/** The committed layer only. Safe in the browser: it is data, not state. */
export function lookupPrecomputed(prompt: string): Basket | null {
  if (!precomputedIsFresh) return null;
  const key = normalize(prompt);
  if (!key) return null;
  return file.baskets[key] ?? null;
}

export function lookup(prompt: string, now = Date.now()): CacheHit | null {
  const key = normalize(prompt);
  if (!key) return null;

  const pre = lookupPrecomputed(prompt);
  if (pre) return { basket: pre, layer: "precomputed" };

  const entry = memory.get(key);
  if (entry) {
    if (now - entry.storedAt < TTL_MS) {
      // Refresh recency so the popular questions survive eviction.
      memory.delete(key);
      memory.set(key, entry);
      return { basket: entry.basket, layer: "memory" };
    }
    memory.delete(key);
  }
  return null;
}

export function remember(prompt: string, basket: Basket, now = Date.now()) {
  const key = normalize(prompt);
  if (!key) return;
  memory.set(key, { basket, storedAt: now });
  while (memory.size > MAX_ENTRIES) {
    const oldest = memory.keys().next().value;
    if (oldest === undefined) break;
    memory.delete(oldest);
  }
}

/** Tests only. */
export function resetMemoryCache() {
  memory.clear();
}

export { normalize };

export const precomputedCount = precomputedIsFresh ? Object.keys(file.baskets).length : 0;
