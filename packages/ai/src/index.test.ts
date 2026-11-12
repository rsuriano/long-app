import { describe, expect, it, vi } from "vitest";
import { W_CAP, W_MIN, findBySymbol } from "@long/universe";
import { promptToBasket } from "./index.ts";
import { extractJson, parseBasket } from "./parse.ts";
import { systemPrompt } from "./prompt.ts";
import { fallbackBasket } from "./fallback.ts";
import type { ChatClient } from "./client.ts";

/** A model that replies with the given texts, in order, recording what it was sent. */
function fakeClient(replies: (string | Error)[]): ChatClient & { calls: unknown[][] } {
  const calls: unknown[][] = [];
  let i = 0;
  return {
    model: "fake",
    calls,
    async complete(messages) {
      calls.push(messages);
      const reply = replies[Math.min(i++, replies.length - 1)];
      if (reply instanceof Error) throw reply;
      return reply ?? "";
    },
  };
}

const GOOD = JSON.stringify({
  name: "AI without Zuckerberg",
  picks: ["NVDAc", "MSFTc", "GOOGLc", "AMZNc"],
  excluded: [{ symbol: "METAc", reason: "Zuckerberg runs it" }],
  note: "The chips and the clouds, minus Meta.",
});

describe("extractJson", () => {
  it("reads a bare object", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });
  it("reads a markdown-fenced object, which cheap models love to send", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('```\n{"a":1}\n```')).toEqual({ a: 1 });
  });
  it("reads an object buried in prose", () => {
    expect(extractJson('Sure! Here you go:\n{"a":1}\nHope that helps.')).toEqual({ a: 1 });
  });
  it("throws when there is no object", () => {
    expect(() => extractJson("I cannot help with that")).toThrow(/no JSON object/);
  });
});

describe("parseBasket", () => {
  it("accepts a valid basket", () => {
    const r = parseBasket(GOOD);
    expect(r.ok).toBe(true);
  });
  it("rejects an invented symbol", () => {
    const r = parseBasket(GOOD.replace("NVDAc", "PLTRc"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toMatch(/unknown symbol PLTRc/);
  });
  it("sizes the basket itself, by market cap and summing to 100", () => {
    const r = parseBasket(GOOD);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const w = r.basket.picks.map((p) => p.weight);
    expect(w.reduce((a, b) => a + b, 0)).toBe(100);
    expect(w).toEqual([...w].sort((a, b) => b - a)); // largest first
    expect(Math.max(...w)).toBeLessThanOrEqual(W_CAP);
    expect(Math.min(...w)).toBeGreaterThanOrEqual(W_MIN);
    // These four are already in cap order, so the order the model gave survives.
    expect(r.basket.picks.map((p) => p.symbol)).toEqual(["NVDAc", "MSFTc", "GOOGLc", "AMZNc"]);
  });

  it("ignores weights a model sends anyway", () => {
    const withWeights = JSON.stringify({
      name: "Bossy", picks: [{ symbol: "NVDAc", weight: 99 }, { symbol: "MSFTc", weight: 1 }, { symbol: "AAPLc", weight: 0 }],
      excluded: [], note: "",
    });
    const r = parseBasket(withWeights);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.basket.picks.map((p) => p.weight).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("rejects a duplicate pick", () => {
    const r = parseBasket(JSON.stringify({ name: "Dup", picks: ["NVDAc", "nvda", "MSFTc"], excluded: [], note: "" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toMatch(/duplicate pick NVDAc/);
  });

  it("rejects picks that are not an array", () => {
    const r = parseBasket(JSON.stringify({ name: "x", picks: "NVDAc", excluded: [], note: "" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toMatch(/must be an array/);
  });
});

describe("systemPrompt", () => {
  it("carries every stock with the metadata the model needs", () => {
    const p = systemPrompt();
    for (const t of ["NVDAc", "SPCXc", "MSTRc"]) expect(p).toContain(t);
    expect(p).toContain("Zuckerberg"); // people, so "without Zuckerberg" resolves
    expect(p).toContain("Elon Musk");
    expect(p).toContain(String(W_CAP));
  });
});

describe("promptToBasket", () => {
  it("returns the model's basket on a clean answer", async () => {
    const client = fakeClient([GOOD]);
    const r = await promptToBasket("AI without Zuckerberg", { client });
    expect(r.source).toBe("model");
    expect(r.attempts).toBe(1);
    expect(r.problems).toEqual([]);
    expect(r.basket.picks.map((p) => p.symbol)).toContain("NVDAc");
    expect(client.calls).toHaveLength(1);
  });

  it("hands the errors back and accepts the corrected answer", async () => {
    const bad = GOOD.replace('"NVDAc"', '"NVIDIAc"');
    const client = fakeClient([bad, GOOD]);
    const r = await promptToBasket("AI without Zuckerberg", { client });
    expect(r.source).toBe("repair");
    expect(r.attempts).toBe(2);
    expect(r.problems.join(" ")).toMatch(/unknown symbol NVIDIAc/);
    // The repair turn must show the model its own answer and the errors.
    const second = client.calls[1] as { role: string; content: string }[];
    expect(second).toHaveLength(4);
    expect(second[2]?.role).toBe("assistant");
    expect(second[3]?.content).toMatch(/unknown symbol NVIDIAc/);
  });

  it("falls back to a valid template after two bad answers", async () => {
    const client = fakeClient(["not json at all"]);
    const r = await promptToBasket("something", { client });
    expect(r.source).toBe("fallback");
    expect(r.attempts).toBe(2);
    expect(parseBasket(JSON.stringify(r.basket)).ok).toBe(true);
  });

  it("falls back when the provider is unreachable, without throwing", async () => {
    const client = fakeClient([new Error("ECONNRESET")]);
    const r = await promptToBasket("AI without Zuckerberg", { client });
    expect(r.source).toBe("fallback");
    expect(r.problems.join(" ")).toMatch(/ECONNRESET/);
  });

  it("falls back when no client is configured", async () => {
    const r = await promptToBasket("AI", { client: undefined, tokens: undefined });
    // clientFromEnv() returns null without a key; in CI there is none.
    if (r.source === "fallback") expect(r.model).toBe("none");
  });

  it("never returns fewer than 3 or more than 10 picks", async () => {
    for (const reply of [GOOD, "garbage"]) {
      const r = await promptToBasket("x", { client: fakeClient([reply]) });
      expect(r.basket.picks.length).toBeGreaterThanOrEqual(3);
      expect(r.basket.picks.length).toBeLessThanOrEqual(10);
    }
  });
});

describe("fallbackBasket", () => {
  it("is a valid, buyable basket", () => {
    const b = fallbackBasket("anything");
    const r = parseBasket(JSON.stringify(b));
    expect(r.ok, r.ok ? "" : r.errors.join("; ")).toBe(true);
    for (const p of b.picks) expect(findBySymbol(p.symbol)).toBeDefined();
  });
});
