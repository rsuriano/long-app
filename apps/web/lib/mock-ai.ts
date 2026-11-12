/**
 * Regex parser ported from the mock (parsePrompt), constrained to the real universe.
 * Kept as the offline fallback and as the fixture set for packages/ai.
 * Weight rules live in @long/universe so the model and the editor share them.
 */
import { capWeightsFor, getTokens, type Token } from "@long/universe";
import type { OwnedIndex } from "./mock-data";

export type MockBasket = {
  name: string;
  picks: string[]; // canonical symbols
  weights: number[];
  excluded: string[];
  note: string;
};

type Theme = { key: string; match: RegExp; name: string; picks: string[]; note: string };

const THEMES: Theme[] = [
  { key: "elon", match: /\b(elon|musk|rockets?|space|mars|starship|starlink)\b/i, name: "Everything Elon",
    picks: ["TSLAc", "SPCXc", "NVDAc"],
    note: "Tesla, SpaceX, and the Nvidia chips both of them run on." },
  { key: "mag7", match: /\b(mag(nificent)?\s?(7|seven)|big tech|faang|mega\s?caps?)\b/i, name: "Magnificent Seven",
    picks: ["AAPLc", "MSFTc", "GOOGLc", "AMZNc", "NVDAc", "METAc", "TSLAc"],
    note: "The seven names that moved the market this decade, in one token." },
  { key: "storage", match: /\b(memory|storage|flash|nand|disks?)\b/i, name: "AI Storage",
    picks: ["SNDKc", "NVDAc", "AMZNc", "GOOGLc", "MSFTc"],
    note: "The flash memory AI data centers are filling, and the clouds buying it." },
  { key: "ai", match: /\b(ai|artificial|gpu|chips?|semis?|semiconductor|infra|data\s?cent\w*|compute)\b/i, name: "AI Infrastructure",
    picks: ["NVDAc", "MSFTc", "GOOGLc", "AMZNc", "METAc", "SNDKc"],
    note: "The chips, the storage and the clouds spending the most on AI." },
  { key: "cloud", match: /\b(cloud|software|enterprise|saas|azure|aws)\b/i, name: "Cloud Giants",
    picks: ["MSFTc", "AMZNc", "GOOGLc", "NVDAc"],
    note: "The three hyperscalers and the chips they rent out by the hour." },
  { key: "daily", match: /\b(every\s?day|daily|use|brands?|consumer|life|mom|mum|dad|parents)\b/i, name: "Everyday Tech",
    picks: ["AAPLc", "AMZNc", "GOOGLc", "METAc", "MSFTc"],
    note: "Companies you probably paid this week. Owning what you use, in one token." },
  { key: "bitcoin", match: /\b(bitcoin|btc|crypto|treasury|saylor)\b/i, name: "Bitcoin Believers",
    picks: ["MSTRc", "TSLAc", "NVDAc"],
    note: "Strategy and Tesla hold bitcoin on the balance sheet; Nvidia sells the picks and shovels." },
];

const DEFAULT_THEME: Theme = {
  key: "core", match: /$^/, name: "Big Tech Core",
  picks: ["AAPLc", "MSFTc", "GOOGLc", "AMZNc", "NVDAc", "METAc"],
  note: "A balanced core of the largest tech businesses. Tell me more and I'll tilt it.",
};

const EX_RE = /\b(?:no|without|minus|not|except|excluding|nothing from|sin)\s+([a-z0-9&.\- ]+?)(?=[,.;]|\s+(?:and|or|but|y|ni)\b|$)/gi;

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function mentions(token: Token, phrase: string): boolean {
  const names = [token.symbol, token.ticker, token.name.split(" ")[0] ?? token.name, ...token.people.map((p) => p.split(" ").pop() ?? p)];
  return names.some((n) => new RegExp("\\b" + esc(n) + "\\b", "i").test(phrase));
}

/** Group words that map to several tokens ("no ads" → Alphabet and Meta). */
const GROUPS: [RegExp, string[]][] = [
  [/\bads?\b|advertis/i, ["GOOGLc", "METAc"]],
  [/\bsocial\b/i, ["METAc"]],
  [/\bbitcoin|crypto\b/i, ["MSTRc"]],
  [/\bcars?|ev\b|volatil|meme/i, ["TSLAc"]],
  [/\bbig tech|faang|mega/i, ["AAPLc", "MSFTc", "GOOGLc", "AMZNc", "METAc"]],
  [/\bhardware|phones?|devices?\b/i, ["AAPLc"]],
];

export function parsePrompt(text: string, owned: OwnedIndex[] = []): MockBasket {
  const t = text.trim();
  const tokens = getTokens();
  const ex = new Set<string>();
  let m: RegExpExecArray | null;
  const exRe = new RegExp(EX_RE.source, EX_RE.flags);
  while ((m = exRe.exec(t))) {
    const phrase = (m[1] ?? "").toLowerCase();
    for (const tk of tokens) if (mentions(tk, phrase)) ex.add(tk.symbol);
    for (const [re, syms] of GROUPS) if (re.test(phrase)) syms.forEach((s) => ex.add(s));
  }
  // Strip exclusion clauses before theme matching so "no Nvidia" doesn't select AI by itself.
  const positive = t.replace(new RegExp(EX_RE.source, EX_RE.flags), "");
  const theme = THEMES.find((th) => th.match.test(positive)) ?? THEMES.find((th) => th.match.test(t)) ?? DEFAULT_THEME;

  const ownedMatch = owned.find((o) => o.name.toLowerCase() === t.toLowerCase());
  if (ownedMatch) {
    return { name: ownedMatch.name, picks: [...ownedMatch.picks], weights: [...ownedMatch.weights], excluded: [],
      note: "Adding to the index you already own. Same weights, same token." };
  }

  const explicit = tokens.filter((tk) => !ex.has(tk.symbol) && mentions(tk, positive)).map((tk) => tk.symbol);
  let picks = theme.picks.filter((p) => !ex.has(p));
  for (const p of explicit) if (!picks.includes(p)) picks.push(p);
  // Universe is small: top up from the default core so a basket never drops under 3 names.
  for (const p of DEFAULT_THEME.picks) if (picks.length < 3 && !ex.has(p) && !picks.includes(p)) picks.push(p);
  picks = picks.slice(0, 10);

  let excluded = [...ex].filter((x) => theme.picks.includes(x));
  if (!excluded.length) excluded = [...ex].slice(0, 3);
  let note = theme.note;
  if (excluded.length) {
    const names = excluded.map((x) => tokens.find((tk) => tk.symbol === x)?.name ?? x);
    note += ` Left out ${names.join(", ")}, as you asked.`;
  }
  return { name: theme.name, picks, weights: capWeightsFor(picks), excluded, note };
}

export { W_CAP, W_MAX, W_MIN, balancedWeights, capWeights, capWeightsFor, dragRange, frontLoadedWeights, normalize, rebalance } from "@long/universe";
