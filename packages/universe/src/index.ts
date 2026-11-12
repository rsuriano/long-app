import registry from "../base.json" with { type: "json" };

export * from "./weights.ts";
import { capWeights } from "./weights.ts";

/** A tokenized stock on Base, as issued by Coinbase under the B20 standard. */
export type Token = {
  /** Onchain symbol, always ends in `c` (e.g. `NVDAc`). Canonical id across the app. */
  symbol: string;
  /** Underlying equity ticker (e.g. `NVDA`). For display only. */
  ticker: string;
  name: string;
  /** Checksummed hex address as published on base.org/stocks, or null if not yet obtained. Never invented. */
  address: `0x${string}` | null;
  /** Truncated form from base.org/stocks; null once the full address is in. */
  addressHint: string | null;
  /** True only when `address` was confirmed against Basescan or an RPC `symbol()` call. */
  verified: boolean;
  verification: string;
  decimals: number | null;
  /** name() as returned by the token contract, e.g. "NVIDIA Corporation". */
  onchainName?: string;
  chainlinkFeed: `0x${string}` | null;
  sector: string;
  country: string;
  ceo: string;
  /** Names people use to refer to the company ("without Zuckerberg"). */
  people: string[];
  blurb: string;
  listedAt: string;
  /** Rounded market cap in USD billions, from `marketCapsAsOf`. Sizes the index weights. */
  marketCapUsdB: number;
};

export type Universe = {
  chainId: number;
  verifiedAt?: string;
  issuer: string;
  standard: string;
  custodian: string;
  source: string;
  updatedAt: string;
  /** Date of the market-cap table the weights are computed from. Refreshed by hand at each rebalance. */
  marketCapsAsOf: string;
  tokens: Token[];
};

export type BasketPick = { symbol: string; weight: number };
export type BasketExclusion = { symbol: string; reason: string };
export type Basket = {
  name: string;
  picks: BasketPick[];
  excluded: BasketExclusion[];
  note: string;
};

export const MIN_PICKS = 3;
export const MAX_PICKS = 10;

const universe: Universe = registry as Universe;

/** The live registry. Treat it as data that grows, never as a constant. */
export function getUniverse(): Universe {
  return universe;
}

export function getTokens(): Token[] {
  return universe.tokens;
}

/** Case-insensitive lookup by onchain symbol (`NVDAc`) or underlying ticker (`NVDA`). */
export function findBySymbol(symbolOrTicker: string): Token | undefined {
  const q = symbolOrTicker.trim().toLowerCase();
  if (!q) return undefined;
  return universe.tokens.find(
    (t) => t.symbol.toLowerCase() === q || t.ticker.toLowerCase() === q,
  );
}

/** A token can be bought only with a verified address. Everything else is display-only. */
export function isTradeable(token: Token): boolean {
  return token.address !== null && token.verified;
}

export function tradeableTokens(): Token[] {
  return universe.tokens.filter(isTradeable);
}

export type ValidationResult =
  | { ok: true; basket: Basket }
  | { ok: false; errors: string[] };

/**
 * Deterministic validator that runs after the model:
 * every symbol exists, integer weights sum to 100, 3..10 picks, no excluded pick, no duplicates.
 * Returns a normalized basket (canonical symbols, trimmed name) on success.
 */
export function validateBasket(input: unknown): ValidationResult {
  const errors: string[] = [];
  if (!input || typeof input !== "object") return { ok: false, errors: ["basket must be an object"] };
  const b = input as Partial<Basket>;

  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) errors.push("name is required");
  if (name.length > 28) errors.push("name must be 28 characters or fewer");

  const picks = Array.isArray(b.picks) ? b.picks : [];
  if (!Array.isArray(b.picks)) errors.push("picks must be an array");
  if (picks.length < MIN_PICKS) errors.push(`at least ${MIN_PICKS} picks required`);
  if (picks.length > MAX_PICKS) errors.push(`at most ${MAX_PICKS} picks allowed`);

  const normalizedPicks: BasketPick[] = [];
  const seen = new Set<string>();
  let sum = 0;
  for (const p of picks) {
    if (!p || typeof p !== "object" || typeof (p as BasketPick).symbol !== "string") {
      errors.push("each pick needs a symbol");
      continue;
    }
    const pick = p as BasketPick;
    const token = findBySymbol(pick.symbol);
    if (!token) {
      errors.push(`unknown symbol ${pick.symbol}`);
      continue;
    }
    if (seen.has(token.symbol)) errors.push(`duplicate pick ${token.symbol}`);
    seen.add(token.symbol);
    if (!Number.isInteger(pick.weight) || pick.weight < 1 || pick.weight > 100) {
      errors.push(`weight for ${token.symbol} must be an integer between 1 and 100`);
    } else {
      sum += pick.weight;
    }
    normalizedPicks.push({ symbol: token.symbol, weight: pick.weight });
  }
  if (picks.length > 0 && sum !== 100) errors.push(`weights must sum to 100, got ${sum}`);

  const excluded = Array.isArray(b.excluded) ? b.excluded : [];
  const normalizedExcluded: BasketExclusion[] = [];
  for (const e of excluded) {
    if (!e || typeof e !== "object" || typeof (e as BasketExclusion).symbol !== "string") {
      errors.push("each exclusion needs a symbol");
      continue;
    }
    const ex = e as BasketExclusion;
    const token = findBySymbol(ex.symbol);
    if (!token) {
      errors.push(`unknown excluded symbol ${ex.symbol}`);
      continue;
    }
    if (seen.has(token.symbol)) errors.push(`${token.symbol} is both picked and excluded`);
    normalizedExcluded.push({ symbol: token.symbol, reason: typeof ex.reason === "string" ? ex.reason : "" });
  }

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    basket: {
      name,
      picks: normalizedPicks,
      excluded: normalizedExcluded,
      note: typeof b.note === "string" ? b.note : "",
    },
  };
}

/**
 * Weights for these symbols, by market cap with the cap and floor of `capWeights`, in the
 * same order as given. Unknown symbols count as zero cap and land on the floor.
 */
export function capWeightsFor(symbols: string[]): number[] {
  const caps = symbols.map((s) => findBySymbol(s)?.marketCapUsdB ?? 0);
  return capWeights(caps);
}
