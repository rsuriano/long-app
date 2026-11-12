"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OwnedIndex } from "@/lib/mock-data";
import { money, pct } from "@/lib/format";
import { series } from "@/lib/series";
import { useStore } from "@/lib/store";
import { AreaChart } from "./charts";
import { HoldRow } from "./HoldRow";

const RANGES = ["1W", "1M", "3M", "1Y"];

export function IndexDetailSheet({ index, seed, open, onClose, real = false, onSell }: { index: OwnedIndex | null; seed: number; open: boolean; onClose: () => void; real?: boolean; onSell?: () => void }) {
  const router = useRouter();
  const { toast } = useStore();
  const [range, setRange] = useState("1M");
  const o = index;
  const up = (o?.delta ?? 0) >= 0;
  const cls = up ? "up" : "down";
  return (
    <>
      <div inert={!open} className={"backdrop" + (open ? " on" : "")} onClick={onClose} />
      <div inert={!open} className={"sheet" + (open ? " on" : "")}>
        <div className="grab" />
        <h2>{o?.name ?? ""}</h2>
        <div className="sub">{o ? `${o.picks.length} stocks · created by you · ${o.created}` : ""}</div>
        <div className="perf">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span className="num" style={{ fontSize: 24, fontWeight: 600 }}>{o ? money(o.value) : ""}</span>
            <span className={"num " + cls} style={{ fontWeight: 600 }}>{o ? pct(o.delta) : ""}</span>
          </div>
          {/* A real index has no price history yet: its move is measured against cost. */}
          {o && !real && <AreaChart vals={series(seed + 7 + RANGES.indexOf(range), up)} cls={cls} />}
          {!real && (
            <div className="range">
              {RANGES.map((r) => (
                <button key={r} className={r === range ? "on" : ""} onClick={() => setRange(r)}>{r}</button>
              ))}
            </div>
          )}
          {real && <div className="tiny" style={{ marginTop: 6 }}>vs. what you paid · live Chainlink prices</div>}
        </div>
        <div className="holdings" style={{ marginTop: 12 }}>
          {o?.picks.map((s, k) => <HoldRow key={s} symbol={s} weight={o.weights[k] ?? 0} />)}
        </div>
        <div className="actions">
          <button className="btn btn-primary" onClick={() => { onClose(); if (o) router.push(`/build?add=${encodeURIComponent(o.id)}`); }}>Add</button>
          {/* Selling is out of v0 (docs/long-plan.md). The sheet stays open so the toast,
              which sits above it, is actually seen. */}
          <button className="btn btn-ghost" onClick={() => (real && onSell ? onSell() : toast("Selling is coming next"))}>Sell</button>
        </div>
      </div>
    </>
  );
}
