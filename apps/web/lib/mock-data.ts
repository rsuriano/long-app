/**
 * Mock state for Fase 0. Everything here is replaced by DB + onchain reads in Fase 2.
 * Baskets only use the real universe (10 Coinbase tokens), see packages/universe.
 */
export type OwnedIndex = {
  id: string;
  name: string;
  picks: string[]; // canonical symbols (NVDAc)
  weights: number[];
  value: number;
  delta: number;
  created: string;
};

export type ActivityItem = {
  t: string;
  s: string;
  v: string;
  small: string;
  ic: string;
  cls?: "up" | "down";
};

export type Curated = { name: string; prompt: string; by: string };

export const INITIAL_OWNED: OwnedIndex[] = [
  { id: "everyday-tech", name: "Everyday Tech", picks: ["AAPLc", "GOOGLc", "METAc", "AMZNc"], weights: [31, 26, 22, 21], value: 1240.5, delta: 3.2, created: "12 Aug" },
  { id: "everything-elon", name: "Everything Elon", picks: ["TSLAc", "SPCXc", "NVDAc"], weights: [40, 35, 25], value: 610.02, delta: -1.1, created: "3 Sep" },
];

export const INITIAL_CASH = 320.0;

export const SUGGEST = [
  "AI without Zuckerberg",
  "Mag 7 minus Tesla",
  "Everything Elon",
  "Companies my mom uses",
  "Cloud, no ads",
  "The AI data center",
];

/**
 * Only baskets that can actually be built from the 10 tokens on Base today. No invented
 * holders or returns: the card says what the basket is and who wrote the prompt.
 */
export const CURATED: Curated[] = [
  { name: "AI without Zuckerberg", prompt: "AI without Zuckerberg", by: "Long" },
  { name: "Mag 7 minus Tesla", prompt: "Mag 7 minus Tesla", by: "suriano.base.eth" },
  { name: "Everything Elon", prompt: "Everything Elon", by: "suriano.base.eth" },
  { name: "Companies my mom uses", prompt: "Companies my mom uses", by: "Long" },
  { name: "Cloud, no ads", prompt: "Cloud, no ads", by: "Long" },
  { name: "The AI data center", prompt: "The AI data center", by: "Long" },
];

export const IDEAS = CURATED.slice(0, 3);

export const INITIAL_ACTIVITY: ActivityItem[] = [
  { t: "Dividend · Everyday Tech", s: "Auto-reinvested · 5 Sep", v: "+$2.14", small: "USDC", ic: "💧", cls: "up" },
  { t: "Rebalanced · Everything Elon", s: "Monthly · 1 Sep", v: "3 trades", small: "$0.04 fee", ic: "🔁" },
  { t: "Went long · Everything Elon", s: "USDC → index · 3 Sep", v: "−$600.00", small: "$0.12 fee", ic: "📈" },
  { t: "Received · USDC", s: "From an exchange · 10 Aug", v: "+$200.00", small: "USDC", ic: "💵", cls: "up" },
];
