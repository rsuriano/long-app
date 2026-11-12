import { MAX_PICKS, MIN_PICKS, capWeightsFor, findBySymbol, validateBasket, type Basket } from "@long/universe";

export type ParseResult = { ok: true; basket: Basket } | { ok: false; errors: string[] };

/**
 * Pulls a JSON object out of a model response. Cheap models wrap answers in markdown
 * fences or add a sentence before the JSON even when told not to, so parsing the raw
 * string is not enough.
 */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const candidates: string[] = [trimmed];

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) candidates.push(fenced[1].trim());

  // Outermost {...} in the response, for a model that prefixes prose.
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last > first) candidates.push(trimmed.slice(first, last + 1));

  for (const c of candidates) {
    try {
      return JSON.parse(c);
    } catch {
      // try the next shape
    }
  }
  throw new SyntaxError("no JSON object found in the model response");
}

/**
 * Reads one pick. The contract asks for a bare symbol string, but a model that insists on
 * `{symbol, weight}` is still understood: the weight is ignored, since we compute it.
 */
function pickSymbol(entry: unknown): string | null {
  if (typeof entry === "string") return entry;
  if (entry && typeof entry === "object") {
    const s = (entry as { symbol?: unknown }).symbol;
    if (typeof s === "string") return s;
  }
  return null;
}

/**
 * Turns a model answer into a validated basket.
 *
 * The model picks the stocks; the weights come from market cap (`capWeightsFor`: capped
 * at 35%, floored at 5%, integers summing to 100), the way real indices are built. Models
 * are good at choosing and bad at arithmetic, and every basket in the app — proposed,
 * edited or fallen back to — then obeys the same rule. Picks are listed largest first.
 */
export function parseBasket(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = extractJson(text);
  } catch (e) {
    return { ok: false, errors: [(e as Error).message] };
  }

  if (!raw || typeof raw !== "object") return { ok: false, errors: ["expected a JSON object"] };
  const body = raw as { name?: unknown; picks?: unknown; excluded?: unknown; note?: unknown };

  if (!Array.isArray(body.picks)) return { ok: false, errors: ['"picks" must be an array of symbols'] };

  const errors: string[] = [];
  const symbols: string[] = [];
  for (const entry of body.picks) {
    const symbol = pickSymbol(entry);
    if (symbol === null) {
      errors.push("every entry in picks must be a symbol string");
      continue;
    }
    const token = findBySymbol(symbol);
    if (!token) {
      errors.push(`unknown symbol ${symbol}`);
      continue;
    }
    if (symbols.includes(token.symbol)) {
      errors.push(`duplicate pick ${token.symbol}`);
      continue;
    }
    symbols.push(token.symbol);
  }
  if (errors.length) return { ok: false, errors };

  // Check the count before sizing. capWeights() cannot reach 100 with fewer than
  // three slices under the cap, so leaving this to validateBasket produced a second,
  // contradictory error about weights — and the model, told two things at once, repeated
  // its answer instead of fixing it.
  if (symbols.length < MIN_PICKS) {
    return { ok: false, errors: [`at least ${MIN_PICKS} picks required, got ${symbols.length}`] };
  }
  if (symbols.length > MAX_PICKS) {
    return { ok: false, errors: [`at most ${MAX_PICKS} picks allowed, got ${symbols.length}`] };
  }

  const weights = capWeightsFor(symbols);
  const picks = symbols
    .map((symbol, i) => ({ symbol, weight: weights[i] ?? 0, i }))
    .sort((a, b) => b.weight - a.weight || a.i - b.i)
    .map(({ symbol, weight }) => ({ symbol, weight }));
  const candidate = {
    name: body.name,
    picks,
    excluded: body.excluded,
    note: body.note,
  };

  // The remaining rules (name, 3..10 picks, no excluded in picks) are still the
  // validator's call; the weights now pass by construction.
  return validateBasket(candidate);
}
