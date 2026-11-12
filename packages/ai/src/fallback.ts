import { capWeightsFor, getTokens, type Basket, type Token } from "@long/universe";

/**
 * Last resort when the model fails twice or is unreachable. The person still gets a real,
 * buyable basket they can edit, instead of an error screen. Deterministic on purpose.
 */
export function fallbackBasket(prompt: string, tokens: Token[] = getTokens()): Basket {
  // The largest, most recognisable names in the universe, in a fixed order.
  const preferred = ["NVDAc", "MSFTc", "AAPLc", "GOOGLc", "AMZNc", "METAc"];
  const bySymbol = new Map(tokens.map((t) => [t.symbol, t]));
  const picks = preferred.filter((s) => bySymbol.has(s)).slice(0, 6);
  // A universe that no longer contains the preferred names still yields something valid.
  if (picks.length < 3) picks.push(...tokens.map((t) => t.symbol).filter((s) => !picks.includes(s)));

  const chosen = picks.slice(0, 6);
  const weights = capWeightsFor(chosen);
  return {
    name: "Big Tech Core",
    picks: chosen.map((symbol, i) => ({ symbol, weight: weights[i] ?? 0 })),
    excluded: [],
    note: `We couldn't read "${prompt.trim()}" this time, so here's a broad basket of the biggest names on Base. Edit it, or try describing it again.`,
  };
}
