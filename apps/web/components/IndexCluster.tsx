"use client";
import { findBySymbol } from "@long/universe";
import type { CSSProperties } from "react";
import { TokenLogo } from "./TokenLogo";

export type ClusterVariant = "grid" | "cloud" | "cloud-proportional";

const MAX_LOGOS = 3;

/** Small stable hash so each index gets its own, repeatable orientation and drift. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Zero gravity: each logo drifts back and forth along its own axis, easing at both ends
 * so it slows to a stop and returns instead of orbiting at a constant speed. Direction,
 * distance and period come from a hash of the index name and the ticker, so no two logos
 * travel together and a card always drifts the same way.
 *
 * Transform only, no layout work, and the global prefers-reduced-motion rule stops it.
 */
function drift(seedKey: string, size: number): CSSProperties {
  const h = hash(seedKey);
  const angle = ((h % 360) * Math.PI) / 180;
  const distance = size * (0.03 + ((h >> 3) % 20) / 1000); // ~1.3-2.2px at 44
  return {
    "--drift-x": `${(Math.cos(angle) * distance).toFixed(2)}px`,
    "--drift-y": `${(Math.sin(angle) * distance).toFixed(2)}px`,
    "--drift-dur": `${5 + ((h >> 8) % 45) / 10}s`, // 5-9.5s each way
    "--drift-delay": `-${((h >> 16) % 90) / 10}s`, // start somewhere along the path
  } as CSSProperties;
}

/**
 * Icon for an index: its top 3 holdings' logos arranged around an imaginary circle,
 * sized by weight. Slots are 120° apart; the whole cloud is rotated by a hash of `seed`
 * (the index name) so different indices look different but each one stays put.
 */
export function IndexCluster({ picks, weights, seed, size = 44, variant = "cloud-proportional" }: { picks: string[]; weights: number[]; seed?: string; size?: number; variant?: ClusterVariant }) {
  const items = picks
    .map((symbol, i) => ({ ticker: findBySymbol(symbol)?.ticker ?? symbol, weight: weights[i] ?? 0 }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, MAX_LOGOS);
  const n = items.length;
  const wMax = items[0]?.weight || 1;

  if (variant === "grid") {
    const d = Math.round(size * 0.4);
    return (
      <span className="cluster grid" style={{ width: size, height: size, gap: Math.round(size * 0.05) }}>
        {items.map((it) => (
          <span key={it.ticker} className="cl" style={{ width: d, height: d, position: "static" }}>
            <TokenLogo ticker={it.ticker} size={Math.round(d * 0.7)} mono="initial" />
          </span>
        ))}
      </span>
    );
  }

  const r = size * 0.27;
  const dMax = size * 0.56;
  const step = 360 / n;
  const rotation = seed ? (hash(seed) % 6) * 60 : 0;
  return (
    <span className="cluster" style={{ width: size, height: size }}>
      {items.map((it, i) => {
        const d = variant === "cloud" ? size * 0.42 : dMax * Math.min(1, Math.max(0.4, it.weight / wMax));
        const a = ((-135 + rotation + i * step) * Math.PI) / 180;
        const cx = size / 2 + r * Math.cos(a);
        const cy = size / 2 + r * Math.sin(a);
        return (
          <span
            key={it.ticker}
            className="cl"
            style={{ width: d, height: d, left: cx - d / 2, top: cy - d / 2, ...drift(`${seed ?? ""}:${it.ticker}`, size) }}
          >
            <TokenLogo ticker={it.ticker} size={Math.round(d * 0.7)} mono="initial" />
          </span>
        );
      })}
    </span>
  );
}
