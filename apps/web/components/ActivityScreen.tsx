"use client";
import { useStore } from "@/lib/store";
import { useWallet } from "@/lib/useWallet";
import { usePurchases } from "@/lib/indices";
import { money, shortHash } from "@/lib/format";
import { Brand } from "./Brand";

export function ActivityScreen() {
  const { activity: demoActivity } = useStore();
  const wallet = useWallet();
  const { purchases: mine } = usePurchases(wallet.address);
  // A real wallet's feed is its purchases through Long, each with its transaction.
  // The demo feed never shows under a real address.
  const activity = wallet.isConnected
    ? mine.map((e) => ({
        t: `${e.kind === "sell" ? "Sold" : e.kind === "add" ? "Added to" : "Went long"} · ${e.name}`,
        s: `${Object.keys(e.units).length} stocks · ${new Date(e.at).toLocaleDateString("en-US", { day: "numeric", month: "short" })} · ${shortHash(e.tx)}`,
        v: `${e.kind === "sell" ? "+" : "−"}${money(e.usd)}`, small: "USDC", ic: e.kind === "sell" ? "💵" : "📈", cls: (e.kind === "sell" ? "up" : undefined) as string | undefined, href: `https://basescan.org/tx/${e.tx}`,
      }))
    : demoActivity.map((a) => ({ ...a, href: undefined as string | undefined }));
  return (
    <section className="screen">
      <div className="topbar">
        <Brand label="Activity" />
      </div>
      <div className="scroll">
        <div className="section" style={{ marginTop: 6 }}>
          <div className="section-head"><h2>Recent</h2><span className="tiny">Dividends auto-reinvest</span></div>
          {activity.length === 0 && <p className="muted">Nothing yet. Your first purchase shows up here, with its Basescan link.</p>}
          <div>
            {activity.map((a, i) => {
              const inner = (
                <>
                  <span className="ic">{a.ic}</span>
                  <span><span className="t">{a.t}</span><br /><span className="s">{a.s}</span></span>
                  <span className={"v " + (a.cls ?? "")}>{a.v}<small>{a.small}</small></span>
                </>
              );
              return a.href
                ? <a className="act" key={i} href={a.href} target="_blank" rel="noreferrer">{inner}</a>
                : <div className="act" key={i}>{inner}</div>;
            })}
          </div>
        </div>
        <p className="legal">Every stock in your index is a token in your wallet. You can see each transaction on Basescan, and take your holdings anywhere Base goes.</p>
      </div>
    </section>
  );
}
