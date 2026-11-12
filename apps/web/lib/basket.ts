import type { Basket } from "@long/universe";
import type { MockBasket } from "./mock-ai";
import { lookupPrecomputed } from "./basket-cache";

/** Server shape (symbol+weight pairs) to the shape the editor works with (parallel arrays). */
export function toEditable(basket: Basket): MockBasket {
  return {
    name: basket.name,
    picks: basket.picks.map((p) => p.symbol),
    weights: basket.picks.map((p) => p.weight),
    excluded: basket.excluded.map((e) => e.symbol),
    note: basket.note,
  };
}

export type BasketResponse = {
  basket: Basket;
  source: "model" | "repair" | "fallback" | "cache";
  model: string;
  attempts: number;
  problems: string[];
  ms: number;
};

/**
 * Gets a basket for a prompt.
 *
 * The baskets shipped with the build are answered here, in the browser: no round trip, no
 * credits, and the static export (which has no API) still answers its own chips instantly.
 * Anything else goes to the server, and throws if it cannot, so the caller falls back to
 * the local parser.
 */
export async function requestBasket(prompt: string, signal?: AbortSignal): Promise<BasketResponse> {
  const precomputed = lookupPrecomputed(prompt);
  if (precomputed) {
    return { basket: precomputed, source: "cache", model: "precomputed", attempts: 0, problems: [], ms: 0 };
  }

  const res = await fetch("/api/basket", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt }),
    signal,
  });
  if (!res.ok) throw new Error(`basket request failed: ${res.status}`);
  return (await res.json()) as BasketResponse;
}
