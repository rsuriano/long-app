import { capWeights, capWeightsFor, W_CAP, W_MIN } from "./index.ts";
import { describe, expect, it } from "vitest";
import {
  findBySymbol,
  getTokens,
  getUniverse,
  isTradeable,
  tradeableTokens,
  validateBasket,
} from "./index";

describe("registry", () => {
  it("has the 10 Coinbase tokens on Base", () => {
    const u = getUniverse();
    expect(u.chainId).toBe(8453);
    expect(getTokens().map((t) => t.symbol).sort()).toEqual(
      ["AAPLc", "AMZNc", "GOOGLc", "METAc", "MSFTc", "MSTRc", "NVDAc", "SNDKc", "SPCXc", "TSLAc"],
    );
  });

  it("every symbol ends in c and matches its ticker", () => {
    for (const t of getTokens()) {
      expect(t.symbol.endsWith("c")).toBe(true);
      expect(t.symbol).toBe(`${t.ticker}c`);
    }
  });

  it("addresses are well-formed and carry the B20 vanity prefix", () => {
    for (const t of getTokens()) {
      if (t.address === null) continue;
      // Checksummed, as published on base.org/stocks (MSFTc starts with an uppercase 0xB2).
      expect(t.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
      expect(t.address.slice(0, 4).toLowerCase()).toBe("0xb2");
      if (t.addressHint) {
        expect(t.address.toLowerCase().endsWith(t.addressHint.slice(-4).toLowerCase())).toBe(true);
      }
    }
  });

  it("all 10 tokens are verified, tradeable and use 8 decimals", () => {
    for (const t of getTokens()) {
      expect(t.verified, t.symbol).toBe(true);
      expect(t.address, t.symbol).not.toBeNull();
      expect(t.decimals, t.symbol).toBe(8);
    }
    expect(tradeableTokens()).toHaveLength(10);
  });

  it("addresses are unique", () => {
    const seen = getTokens().map((t) => t.address?.toLowerCase());
    expect(new Set(seen).size).toBe(seen.length);
  });

  it("never marks a token verified without an address", () => {
    for (const t of getTokens()) if (t.verified) expect(t.address).not.toBeNull();
  });

  it("tradeable tokens are exactly the verified ones", () => {
    expect(tradeableTokens().every(isTradeable)).toBe(true);
    expect(tradeableTokens().map((t) => t.symbol)).toContain("NVDAc");
  });
});

describe("findBySymbol", () => {
  it("accepts symbol or ticker, case-insensitive", () => {
    expect(findBySymbol("NVDAc")?.symbol).toBe("NVDAc");
    expect(findBySymbol("nvda")?.symbol).toBe("NVDAc");
    expect(findBySymbol("googl")?.name).toBe("Alphabet");
    expect(findBySymbol("COIN")).toBeUndefined();
    expect(findBySymbol("")).toBeUndefined();
  });
});

describe("validateBasket", () => {
  const good = {
    name: "AI without Zuckerberg",
    picks: [
      { symbol: "NVDA", weight: 40 },
      { symbol: "MSFTc", weight: 25 },
      { symbol: "GOOGLc", weight: 20 },
      { symbol: "AMZNc", weight: 15 },
    ],
    excluded: [{ symbol: "META", reason: "Zuckerberg" }],
    note: "The chips and the clouds, minus Meta.",
  };

  it("accepts a valid basket and canonicalizes symbols", () => {
    const r = validateBasket(good);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.basket.picks[0]?.symbol).toBe("NVDAc");
      expect(r.basket.excluded[0]?.symbol).toBe("METAc");
    }
  });

  it("rejects unknown symbols", () => {
    const r = validateBasket({ ...good, picks: [...good.picks, { symbol: "COIN", weight: 0 }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toMatch(/unknown symbol COIN/);
  });

  it("rejects weights that do not sum to 100 or are not integers", () => {
    const r1 = validateBasket({ ...good, picks: good.picks.map((p) => ({ ...p, weight: 30 })) });
    expect(r1.ok).toBe(false);
    const r2 = validateBasket({
      ...good,
      picks: [{ symbol: "NVDAc", weight: 33.3 }, { symbol: "MSFTc", weight: 33.3 }, { symbol: "GOOGLc", weight: 33.4 }],
    });
    expect(r2.ok).toBe(false);
  });

  it("enforces 3..10 picks", () => {
    expect(validateBasket({ ...good, picks: good.picks.slice(0, 2) }).ok).toBe(false);
    const eleven = Array.from({ length: 11 }, (_, i) => ({ symbol: `X${i}`, weight: 9 }));
    expect(validateBasket({ ...good, picks: eleven }).ok).toBe(false);
  });

  it("rejects a pick that is also excluded, and duplicates", () => {
    const r = validateBasket({ ...good, excluded: [{ symbol: "NVDAc", reason: "" }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toMatch(/both picked and excluded/);
    const d = validateBasket({
      ...good,
      picks: [{ symbol: "NVDAc", weight: 50 }, { symbol: "nvda", weight: 25 }, { symbol: "MSFTc", weight: 25 }],
    });
    expect(d.ok).toBe(false);
  });

  it("rejects garbage input without throwing", () => {
    expect(validateBasket(null).ok).toBe(false);
    expect(validateBasket("nope").ok).toBe(false);
    expect(validateBasket({}).ok).toBe(false);
  });
});

describe("capWeights", () => {
  it("is proportional to cap, capped, floored, integers summing to 100", () => {
    const w = capWeights([4400, 3700, 2900, 2400, 40]);
    expect(w).toEqual([31, 26, 21, 17, 5]); // the small name is floored, the rest share 95 by cap
    expect(w.reduce((a, b) => a + b, 0)).toBe(100);
    expect(w[4]).toBe(W_MIN);
    expect(capWeights([9000, 500, 500])).toEqual([35, 33, 32]); // the giant is capped
    expect(w[1]).toBeGreaterThan(w[2] ?? 0);
    expect(w.every(Number.isInteger)).toBe(true);
  });
  it("gives two giants and a small one the same shape as before", () => {
    expect(capWeights([4400, 1100, 800])).toEqual([35, 35, 30]);
  });
  it("every token in the registry has a cap, so any basket can be sized", () => {
    for (const t of getUniverse().tokens) expect(t.marketCapUsdB).toBeGreaterThan(0);
    for (const n of [3, 5, 10]) {
      const w = capWeightsFor(getUniverse().tokens.slice(0, n).map((t) => t.symbol));
      expect(w.reduce((a, b) => a + b, 0)).toBe(100);
      expect(Math.max(...w)).toBeLessThanOrEqual(W_CAP);
      expect(Math.min(...w)).toBeGreaterThanOrEqual(W_MIN);
    }
  });
});
