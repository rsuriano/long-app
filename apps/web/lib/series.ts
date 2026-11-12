/** Deterministic mock price series, same generator as the mock so charts look identical. */
function seeded(seed: number) {
  let x = seed * 9301 + 49297;
  return () => {
    x = (x * 9301 + 49297) % 233280;
    return x / 233280;
  };
}
export function series(seed: number, up: boolean): number[] {
  const r = seeded(seed);
  let v = 50;
  const out: number[] = [];
  for (let i = 0; i < 30; i++) {
    v += (r() - 0.5 + (up ? 0.06 : -0.04)) * 6;
    out.push(v);
  }
  return out;
}
export function toPoints(vals: number[], w: number, h: number, pad: number, top: number): [number, number][] {
  const min = Math.min(...vals), max = Math.max(...vals);
  return vals.map((v, i) => [(i / (vals.length - 1)) * w, h - ((v - min) / (max - min || 1)) * (h - pad) - top]);
}
export function pathD(pts: [number, number][]) {
  return pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
}
