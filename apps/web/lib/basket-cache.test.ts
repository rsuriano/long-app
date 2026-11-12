import { beforeEach, describe, expect, it } from "vitest";
import type { Basket } from "@long/universe";
import { lookup, normalize, remember, resetMemoryCache } from "./basket-cache";

const basket = (name: string): Basket => ({
  name,
  picks: [
    { symbol: "NVDAc", weight: 40 },
    { symbol: "MSFTc", weight: 35 },
    { symbol: "AAPLc", weight: 25 },
  ],
  excluded: [],
  note: "",
});

beforeEach(resetMemoryCache);

describe("normalize", () => {
  it("treats the same question asked differently as one key", () => {
    const canonical = normalize("AI without Zuckerberg");
    for (const variant of ["ai without zuckerberg", "  AI   without Zuckerberg!! ", "AI, without Zuckerberg."]) {
      expect(normalize(variant)).toBe(canonical);
    }
  });
  it("ignores accents, so Spanish prompts hit the same entry", () => {
    expect(normalize("robótica china")).toBe(normalize("robotica china"));
  });
  it("keeps different questions apart", () => {
    expect(normalize("AI without Zuckerberg")).not.toBe(normalize("AI with Zuckerberg"));
  });
});

describe("memory layer", () => {
  it("returns what it stored", () => {
    remember("something new", basket("Kept"));
    const hit = lookup("Something New!");
    expect(hit?.layer).toBe("memory");
    expect(hit?.basket.name).toBe("Kept");
  });

  it("misses on an unseen prompt", () => {
    expect(lookup("nobody has ever asked this")).toBeNull();
  });

  it("ignores a blank prompt", () => {
    remember("   ", basket("Blank"));
    expect(lookup("   ")).toBeNull();
  });

  it("expires after a day", () => {
    const t0 = 1_000_000;
    remember("aging prompt", basket("Old"), t0);
    expect(lookup("aging prompt", t0 + 60_000)).not.toBeNull();
    expect(lookup("aging prompt", t0 + 25 * 60 * 60_000)).toBeNull();
  });

  it("evicts the least recently used, keeping what people keep asking", () => {
    remember("popular one", basket("Popular"));
    for (let i = 0; i < 320; i++) {
      remember(`filler ${i}`, basket(`F${i}`));
      if (i % 40 === 0) lookup("popular one"); // keep it warm
    }
    expect(lookup("popular one")).not.toBeNull();
    expect(lookup("filler 0")).toBeNull();
  });
});

describe("precomputed layer", () => {
  it("answers the chips the app ships with, instantly and for free", () => {
    const hit = lookup("AI without Zuckerberg");
    expect(hit, "run `pnpm --filter @long/web precompute` if this fails").not.toBeNull();
    expect(hit?.layer).toBe("precomputed");
    expect(hit?.basket.picks.length).toBeGreaterThanOrEqual(3);
  });
});
