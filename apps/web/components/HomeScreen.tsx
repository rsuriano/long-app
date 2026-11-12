"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { findBySymbol, getUniverse } from "@long/universe";
import { IDEAS } from "@/lib/mock-data";
import { money, pct } from "@/lib/format";
import { series } from "@/lib/series";
import { useStore } from "@/lib/store";
import { Brand } from "./Brand";
import { AccountAvatar } from "./AccountAvatar";
import { useWallet } from "@/lib/useWallet";
import { useHoldings } from "@/lib/useHoldings";
import { useDemoMode } from "@/lib/demo";
import { toOwned, uncovered, useSavedIndices } from "@/lib/indices";
import { WelcomeScreen } from "./WelcomeScreen";
import { TokenLogo } from "./TokenLogo";
import { Sparkline } from "./charts";
import { IndexDetailSheet } from "./IndexDetailSheet";
import { IndexCluster } from "./IndexCluster";
import { AddFundsSheet } from "./AddFundsSheet";
import { GoLongSheet } from "./GoLongSheet";
import { SellSheet } from "./SellSheet";
import { parsePrompt } from "@/lib/mock-ai";
import { lookupPrecomputed } from "@/lib/basket-cache";
import { toEditable } from "@/lib/basket";

export function HomeScreen({ openId }: { openId?: string }) {
  const router = useRouter();
  const { owned: demoOwned, cash } = useStore();
  const wallet = useWallet();
  const live = useHoldings(wallet.address);
  const { indices: saved, isLoading: savedLoading } = useSavedIndices(wallet.address);
  // With a wallet, "your indices" is what this wallet bought through Long, valued now.
  const owned = wallet.isConnected ? toOwned(saved, live.prices) : demoOwned;
  const others = wallet.isConnected ? uncovered(saved, live.holdings) : [];
  const { demo, enterDemo, exitDemo } = useDemoMode();
  const [open, setOpen] = useState<string | null>(null);
  const [sheet, setSheet] = useState<"funds" | "golong" | "sell" | null>(null);
  const universe = getUniverse();

  // Deep link /i/[id]: mount closed, then slide up so the transition runs.
  useEffect(() => {
    if (!openId) return;
    if (!owned.some((o) => o.id === openId)) {
      // A stale or mistyped link: say nothing, but do not keep a URL that shows nothing.
      window.history.replaceState(null, "", "/");
      return;
    }
    const id = requestAnimationFrame(() => setOpen(openId));
    return () => cancelAnimationFrame(id);
  }, [openId, owned]);

  // Opening a sheet pushes a history entry, so back has to close it. Without this the
  // URL went back to "/" while the sheet stayed up, and a second back left the app.
  useEffect(() => {
    const onPop = () => setOpen(null);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const openIndex = (id: string) => {
    setOpen(id);
    window.history.pushState(null, "", `/i/${id}`);
  };
  const close = () => {
    setOpen(null);
    if (location.pathname !== "/") window.history.replaceState(null, "", "/");
  };

  const demoTotal = demoOwned.reduce((a, o) => a + o.value, 0) + cash;
  // Connected: "long" is only what is at risk — the stocks at their Chainlink price. USDC
  // is not a position; it sits in Available, underneath.
  const total = wallet.isConnected ? live.totalUsd : demoTotal;
  // Derived from the positions, so it moves when they do. A fixed "+2.4% today" that
  // survived every purchase read as broken the second time someone bought.
  const dayDelta = owned.reduce((a, o) => a + (o.value * o.delta) / 100, 0);
  const dayPct = total ? (dayDelta / total) * 100 : 0;
  const idx = owned.findIndex((o) => o.id === open);

  // Nothing to show while wagmi restores a session from the cookie: rendering the welcome
  // screen for a beat and then swapping it for the balance looked like a glitch.
  if (wallet.isReconnecting) return <section className="screen" />;
  if (!wallet.isConnected && !demo) return <WelcomeScreen wallet={wallet} onDemo={enterDemo} />;

  return (
    <section className="screen">
      <div className="topbar">
        <Brand />
        <AccountAvatar />
      </div>
      <div className="scroll">
        <div className="hero">
          <div className="eyebrow">You are long</div>
          <div className="total num">{money(total)}</div>
          {wallet.isConnected ? (
            <div className="delta"><span className="hero-live">Live on Base</span></div>
          ) : (
            <div className="delta">
              <span className="pill num">{pct(dayPct)}</span>{" "}
              <span>today · <span className="num">{dayDelta < 0 ? "−" : "+"}{money(Math.abs(dayDelta))}</span></span>
            </div>
          )}
          <div className="row">
            {wallet.isConnected ? (
              <button className="cash" onClick={() => setSheet("funds")} aria-label="Add funds">
                <span className="cash-label">Available <span className="cash-plus" aria-hidden="true">+</span></span>
                <b className="num">
                  <img src="/img/usdc.png" alt="" />
                  {wallet.usdc !== null ? `${money(wallet.usdc)} USDC` : "…"}
                </b>
              </button>
            ) : (
              <button className="cash cash-connect" onClick={exitDemo} aria-label="Leave the demo">
                <span className="cash-label">Demo</span>
                <b className="num">Connect wallet →</b>
              </button>
            )}
            <button
              className="btn btn-hero"
              onClick={() => (owned.length ? setSheet("golong") : router.push("/build"))}
            >
              Go long
            </button>
          </div>
        </div>

        {wallet.isConnected ? (
        <div className="section">
          <div className="section-head"><h2>Your indices</h2><span className="tiny">Live on Base</span></div>
          {(live.isLoading || savedLoading) && owned.length === 0 && <p className="muted">Reading your wallet…</p>}
          {!live.isLoading && !savedLoading && owned.length === 0 && others.length === 0 && (
            <p className="muted">Nothing yet. Build an index and go long, or add USDC first.</p>
          )}
          <div className="list">
            {owned.map((o) => {
              const up = o.delta >= 0;
              return (
                <button key={o.id} className="row-card" onClick={() => openIndex(o.id)}>
                  <span className="icon"><IndexCluster picks={o.picks} weights={o.weights} seed={o.name} /></span>
                  <span><span className="t">{o.name}</span><span className="s">{o.picks.length} stocks · {o.created}</span></span>
                  <span className="v">
                    <span className="num" style={{ display: "block" }}>{money(o.value)}</span>
                    <small className={(up ? "up" : "down") + " num"}>{pct(o.delta)} <span className="tiny">all time</span></small>
                  </span>
                </button>
              );
            })}
          </div>
          {others.length > 0 && (
            <>
              <div className="section-head" style={{ marginTop: 18 }}><h2 style={{ fontSize: 15 }}>Other stocks</h2><span className="tiny">In your wallet, outside an index</span></div>
              <div className="list">
                {others.map((h) => {
                  const t = findBySymbol(h.symbol);
                  return (
                    <div key={h.symbol} className="row-card">
                      <span className="icon"><TokenLogo ticker={t?.ticker ?? h.symbol} size={26} /></span>
                      <span><span className="t">{t?.name ?? h.symbol}</span><span className="s">{h.amount.toFixed(4)} {h.symbol} · {money(h.priceUsd)}</span></span>
                      <span className="v"><span className="num" style={{ display: "block" }}>{money(h.amount * h.priceUsd)}</span></span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
        ) : (
        <div className="section">
          <div className="section-head"><h2>Your indices</h2><span className="tiny">Demo · Tokenized stocks on Base</span></div>
          <div className="list">
            {owned.map((o, i) => {
              const up = o.delta >= 0;
              return (
                <button key={o.id} className="row-card" onClick={() => openIndex(o.id)}>
                  <span className="icon"><IndexCluster picks={o.picks} weights={o.weights} seed={o.name} /></span>
                  <span><span className="t">{o.name}</span><span className="s">{o.picks.length} stocks · {o.created}</span></span>
                  <span className="v">
                    <Sparkline vals={series(i + 7, up)} cls={up ? "up" : "down"} />
                    <span className="num" style={{ display: "block" }}>{money(o.value)}</span>
                    <small className={(up ? "up" : "down") + " num"}>{pct(o.delta)}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        )}

        <div className="section">
          <div className="section-head"><h2>Ideas to start from</h2><Link className="link" href="/explore">See all</Link></div>
          <div className="list">
            {IDEAS.map((i) => {
              // Show the basket this card actually hands over. Drawing the regex parser's
              // guess meant the icon promised stocks the wizard would not deliver.
              const pre = lookupPrecomputed(i.prompt);
              const b = pre ? toEditable(pre) : parsePrompt(i.prompt);
              return (
              <button key={i.name} className="row-card" onClick={() => router.push(`/build?q=${encodeURIComponent(i.prompt)}`)}>
                <span className="icon"><IndexCluster picks={b.picks} weights={b.weights} seed={i.name} /></span>
                <span><span className="t">{pre?.name ?? i.name}</span><span className="s">{b.picks.length} stocks · by {i.by}</span></span>
                <span className="link">Copy ›</span>
              </button>
              );
            })}
          </div>
        </div>

        <p className="legal">
          {universe.tokens.length} tokenized stocks live on Base today, issued by {universe.issuer} and custodied by {universe.custodian}. Available only to eligible users outside the United States. Long is the app, not the issuer. Nothing here is investment advice.
        </p>
      </div>

      <IndexDetailSheet index={idx >= 0 ? owned[idx] ?? null : null} seed={Math.max(idx, 0)} open={open !== null && idx >= 0 && sheet !== "sell"} onClose={close} real={wallet.isConnected} onSell={() => setSheet("sell")} />
      <SellSheet index={idx >= 0 ? saved[idx] ?? null : null} open={sheet === "sell"} onClose={() => { setSheet(null); close(); }} />
      <AddFundsSheet open={sheet === "funds"} onClose={() => setSheet(null)} address={wallet.address} />
      <GoLongSheet owned={owned} open={sheet === "golong"} onClose={() => setSheet(null)} />
    </section>
  );
}
