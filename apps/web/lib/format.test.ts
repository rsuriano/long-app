import { describe, expect, it } from "vitest";
import { money, nextIndexId, pct, slug } from "./format";

/**
 * One number convention only: US, where the comma groups thousands and the period is
 * the decimal point. The mock mixed it with the Argentine way, which made a period mean
 * two different things on one screen.
 */
describe("number formatting", () => {
  it("groups thousands with commas and never with periods", () => {
    expect(money(2170.5)).toBe("$2,170.50");
    expect(money(1234567.891)).toBe("$1,234,567.89");
  });

  it("uses the period only as a decimal point", () => {
    for (const s of [money(2170.52), money(412800), pct(2.4)]) {
      const afterPeriod = s.split(".")[1];
      if (afterPeriod !== undefined) expect(afterPeriod).not.toMatch(/^\d{3}(\D|$)/);
    }
  });


  it("always shows two decimals for money, and a sign for percentages", () => {
    expect(money(100)).toBe("$100.00");
    expect(pct(2.4)).toBe("+2.4%");
    expect(pct(-1.1)).toBe("-1.1%");
  });
});

/**
 * Two indices can legitimately share a name: buying a curated idea you already own is the
 * normal way to get there. Merging them by name silently replaced the basket the person
 * had just reviewed, so ids have to stay distinct.
 */
describe("nextIndexId", () => {
  it("uses the slug when it is free", () => {
    expect(nextIndexId("Everything Elon", [])).toBe("everything-elon");
  });

  it("never collides with an id already in use", () => {
    expect(nextIndexId("Everything Elon", ["everything-elon"])).toBe("everything-elon-2");
    expect(nextIndexId("Everything Elon", ["everything-elon", "everything-elon-2"])).toBe("everything-elon-3");
  });

  it("still returns something routable when the name has no letters or digits", () => {
    expect(slug("🚀🚀🚀 !!!")).toBe("");
    expect(nextIndexId("🚀🚀🚀 !!!", [])).toBe("index");
    expect(nextIndexId("🚀🚀🚀 !!!", ["index"])).toBe("index-2");
  });

  it("ignores case and punctuation the way a URL would", () => {
    expect(nextIndexId("Mag 7, minus Tesla!", [])).toBe("mag-7-minus-tesla");
  });
});
