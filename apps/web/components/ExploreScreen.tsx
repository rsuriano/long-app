"use client";
import { useRouter } from "next/navigation";
import { CURATED } from "@/lib/mock-data";
import { parsePrompt } from "@/lib/mock-ai";
import { lookupPrecomputed } from "@/lib/basket-cache";
import { toEditable } from "@/lib/basket";
import { IndexCluster } from "./IndexCluster";
import { Brand } from "./Brand";

export function ExploreScreen() {
  const router = useRouter();
  return (
    <section className="screen">
      <div className="topbar">
        <Brand label="Ideas" />
      </div>
      <div className="scroll">
        <h1 style={{ fontSize: 24, letterSpacing: "-.01em", marginTop: 4 }}>Ideas to start from</h1>
        <p className="muted" style={{ margin: "6px 0 16px" }}>Copy one as a starting point, then make it yours.</p>
        <div className="list">
          {CURATED.map((c) => {
            // Same as Home: the icon and the name have to be the basket you will get.
            const pre = lookupPrecomputed(c.prompt);
            const b = pre ? toEditable(pre) : parsePrompt(c.prompt);
            return (
            <button key={c.name} className="row-card" onClick={() => router.push(`/build?q=${encodeURIComponent(c.prompt)}`)}>
              <span className="icon"><IndexCluster picks={b.picks} weights={b.weights} seed={c.name} /></span>
              <span><span className="t">{pre?.name ?? c.name}</span><span className="s">{b.picks.length} stocks · by {c.by}</span></span>
              <span className="link">Copy ›</span>
            </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
