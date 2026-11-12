"use client";
import { useRouter } from "next/navigation";
import type { OwnedIndex } from "@/lib/mock-data";
import { money, pct } from "@/lib/format";
import { IndexCluster } from "./IndexCluster";

/**
 * "Go long" adds to something you already own; the + tab builds something new. Before,
 * both led to the same wizard, so the hero button was a second door to the same room.
 *
 * Picking an index here skips the prompt and the basket review — you already decided what
 * it is — and drops straight into the amount step.
 */
export function GoLongSheet({ owned, open, onClose }: { owned: OwnedIndex[]; open: boolean; onClose: () => void }) {
  const router = useRouter();

  return (
    <>
      <div inert={!open} className={"backdrop" + (open ? " on" : "")} onClick={onClose} />
      <div inert={!open} className={"sheet" + (open ? " on" : "")} role="dialog" aria-label="Go long">
        <div className="grab" />
        <h2>Go long</h2>
        <div className="sub">Put more into an index you already own.</div>

        <div className="list" style={{ marginTop: 16 }}>
          {owned.map((o, i) => (
            <button
              key={o.id}
              className="row-card"
              onClick={() => { onClose(); router.push(`/build?add=${encodeURIComponent(o.id)}`); }}
            >
              <span className="icon"><IndexCluster picks={o.picks} weights={o.weights} seed={o.name} /></span>
              <span>
                <span className="t">{o.name}</span>
                <span className="s">{o.picks.length} stocks · {o.created}</span>
              </span>
              <span className="v">
                <span className="num" style={{ display: "block" }}>{money(o.value)}</span>
                <small className={(o.delta >= 0 ? "up" : "down") + " num"}>{pct(o.delta)}</small>
              </span>
            </button>
          ))}
        </div>

        <div className="actions" style={{ gridTemplateColumns: "1fr" }}>
          <button className="btn btn-primary" onClick={() => { onClose(); router.push("/build"); }}>
            Build a new one
          </button>
        </div>
      </div>
    </>
  );
}
