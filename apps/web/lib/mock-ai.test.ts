import { describe, expect, it } from "vitest";
import { validateBasket } from "@long/universe";
import { SUGGEST } from "./mock-data";
import { W_CAP, W_MAX, W_MIN, balancedWeights, dragRange, frontLoadedWeights, rebalance, parsePrompt } from "./mock-ai";

const toBasket = (b: ReturnType<typeof parsePrompt>) => ({
  name: b.name,
  picks: b.picks.map((symbol, i) => ({ symbol, weight: b.weights[i] ?? 0 })),
  excluded: b.excluded.map((symbol) => ({ symbol, reason: "" })),
  note: b.note,
});

describe("parsePrompt (fixtures for packages/ai)", () => {
  it("every suggestion chip yields a basket that passes validateBasket", () => {
    for (const s of SUGGEST) {
      const r = validateBasket(toBasket(parsePrompt(s)));
      expect(r.ok, `${s}: ${!r.ok ? r.errors.join("; ") : ""}`).toBe(true);
    }
  });

  it("AI without Zuckerberg: AI names, no Meta", () => {
    const b = parsePrompt("AI without Zuckerberg");
    expect(b.picks).toContain("NVDAc");
    expect(b.picks).not.toContain("METAc");
    expect(b.excluded).toEqual(["METAc"]);
  });

  it("Mag 7 minus Tesla", () => {
    const b = parsePrompt("Mag 7 minus Tesla");
    expect(b.picks).toHaveLength(6);
    expect(b.picks).not.toContain("TSLAc");
  });

  it("Everything Elon: Tesla and SpaceX", () => {
    const b = parsePrompt("Everything Elon");
    expect(b.picks.slice(0, 2)).toEqual(["TSLAc", "SPCXc"]);
  });

  it("Cloud, no ads: drops Alphabet and Meta", () => {
    const b = parsePrompt("Cloud, no ads");
    expect(b.picks).not.toContain("GOOGLc");
    expect(b.picks).not.toContain("METAc");
    expect(b.picks.length).toBeGreaterThanOrEqual(3);
  });

  it("an unknown theme falls back to the core basket", () => {
    expect(parsePrompt("something surprising").name).toBe("Big Tech Core");
  });

  it("weights are integers summing to 100", () => {
    for (const n of [3, 5, 7, 10]) expect(frontLoadedWeights(n).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("proposed weights are capped and within the editable bounds", () => {
    for (const n of [3, 4, 5, 6, 7, 10]) {
      const w = balancedWeights(n);
      expect(w.reduce((a, b) => a + b, 0)).toBe(100);
      expect(Math.max(...w)).toBeLessThanOrEqual(W_CAP);
      expect(Math.min(...w)).toBeGreaterThanOrEqual(W_MIN);
      expect(w.every(Number.isInteger)).toBe(true);
    }
    expect(balancedWeights(3)).toEqual([35, 35, 30]);
  });
});

describe("rebalance", () => {
  it("keeps locked slices and proportions of the rest", () => {
    expect(rebalance([50, 30, 20], new Set([0]))).toEqual([50, 30, 20]);
    expect(rebalance([40, 30, 20], new Set([0]))).toEqual([40, 36, 24]);
  });
  it("clamps every free slice to [W_MIN, W_MAX]", () => {
    const r = rebalance([50, 5, 5, 5, 5, 30], new Set([0]));
    expect(r).not.toBeNull();
    expect(r!.reduce((a, b) => a + b, 0)).toBe(100);
    for (const [i, w] of r!.entries()) if (i !== 0) { expect(w).toBeGreaterThanOrEqual(W_MIN); expect(w).toBeLessThanOrEqual(W_MAX); }
  });
  it("returns null when nothing can move", () => {
    expect(rebalance([50, 30, 20], new Set([0, 1, 2]))).not.toBeNull(); // already 100
    expect(rebalance([50, 30, 25], new Set([0, 1, 2]))).toBeNull();
    expect(rebalance([50, 45, 5], new Set([0, 1]))).toEqual([50, 45, 5]);
    expect(rebalance([50, 46, 5], new Set([0, 1]))).toBeNull();
  });
  it("dragRange bounds a slice so the others can still fit", () => {
    expect(dragRange([34, 33, 33], 0, new Set())).toEqual([W_MIN, W_MAX]);
    // with two others locked at 30 each, the free slice can only be 40
    expect(dragRange([40, 30, 30], 0, new Set([1, 2]))).toEqual([40, 40]);
    // one other locked at 45 and one free: 100-45-50=5 .. 100-45-5=50
    expect(dragRange([30, 45, 25], 0, new Set([1]))).toEqual([W_MIN, W_MAX]);
  });
});
