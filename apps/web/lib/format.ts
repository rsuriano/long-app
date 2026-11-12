export const money = (n: number) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const pct = (n: number) => (n >= 0 ? "+" : "") + n.toFixed(1) + "%";
/** A full-length hash, so what gets copied has the shape of the real thing (Fase 2). */
export function txHash() {
  const h = "0123456789abcdef";
  let s = "0x";
  for (let i = 0; i < 64; i++) s += h[(Math.random() * 16) | 0];
  return s;
}

export const shortHash = (hash: string) => `${hash.slice(0, 6)}…${hash.slice(-4)}`;
export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/**
 * A url-safe id for a new index that no existing one is using. Two indices really can
 * share a name — buying a curated idea you already own is the normal way to get there —
 * so the id, not the name, is what tells them apart.
 */
export function nextIndexId(name: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  // A name of only emoji or punctuation slugs to "", which would be an unroutable id.
  const base = slug(name) || "index";
  let id = base;
  for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
  return id;
}
