"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { findBySymbol, getTokens } from "@long/universe";
import { SUGGEST } from "@/lib/mock-data";
import { W_MAX, W_MIN, capWeightsFor, dragRange, parsePrompt, rebalance, type MockBasket } from "@/lib/mock-ai";
import { requestBasket, toEditable } from "@/lib/basket";
import { lookupPrecomputed } from "@/lib/basket-cache";
import { money, shortHash, txHash } from "@/lib/format";
import { useStore } from "@/lib/store";
import { useWallet } from "@/lib/useWallet";
import { useConfig, useSendCalls } from "wagmi";
import { waitForCallsStatus } from "wagmi/actions";
import { useQueryClient } from "@tanstack/react-query";
import { planBuy, type BuyPlan } from "@long/execution";
import { recordPurchase, toOwned, useInvalidateRecord, useSavedIndices } from "@/lib/indices";
import { Confetti } from "./Confetti";
import { ConsentSheet } from "./ConsentSheet";
import { useConsent } from "@/lib/useConsent";
import { ArrowIcon, CheckIcon, PencilIcon } from "./icons";
import { BaseBadge } from "./Brand";
import { HoldRow } from "./HoldRow";
import { IndexCluster } from "./IndexCluster";

const PRESETS = [25, 100, 250, 500];
/**
 * USDC that must stay in the wallet when buying: Coinbase's paymaster charges gas in
 * USDC and reserves it up front from the estimated gas limit (well above the ~$0.02 a
 * buy really costs). Spend to the last cent and the wallet falls back to asking for ETH.
 */
export const GAS_RESERVE_USD = 0.25;
/** Matches the cap the route applies, so nobody types past it in silence. */
const MAX_PROMPT = 200;
const THINKING_MS = 520;

type Phase = "idle" | "thinking" | "buying";

export function BuildWizard() {
  const router = useRouter();
  const params = useSearchParams();
  const { owned: demoOwned, cash: demoCash, buy, toast } = useStore();
  const wallet = useWallet();
  const { indices: saved } = useSavedIndices(wallet.address);
  const consent = useConsent(wallet.address);
  const [askConsent, setAskConsent] = useState(false);
  // A tap on the button while it cannot buy: the hint turns red and shakes, so the
  // reason is seen instead of a button that just does nothing.
  const [nudge, setNudge] = useState(false);
  const invalidateRecord = useInvalidateRecord();
  const config = useConfig();
  const queryClient = useQueryClient();
  const { sendCallsAsync } = useSendCalls();
  // With a wallet everything is real: the USDC balance on Base, and the purchase — one
  // Aerodrome swap per stock, batched into a single signature (EIP-5792).
  const real = wallet.isConnected;
  const cash = real ? (wallet.usdc ?? 0) : demoCash;
  // What can be topped up: the wallet's saved indices, or the demo's.
  const owned = real ? toOwned(saved, new Map()) : demoOwned;
  // Came in with a basket already chosen (a chip, an idea from the list): there was never
  // a step 1 here, so the flow is two steps and back from the first one leaves.
  const prefilled = params.get("q") !== null && params.get("add") === null;

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [prompt, setPrompt] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [thinkIdx, setThinkIdx] = useState(-1); // index of the step currently "doing"; 3 = all done
  const [basket, setBasket] = useState<MockBasket | null>(null);
  const [offline, setOffline] = useState(false);
  const [amount, setAmount] = useState(100);
  const [editingAmt, setEditingAmt] = useState(false);
  const [amtText, setAmtText] = useState("");
  const [buyLabel, setBuyLabel] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ name: string; tx: string; real?: boolean } | null>(null);
  // The priced batch, ready before the tap. The wallet popup must open inside the tap's
  // own gesture: on iOS a popup opened after an await lands in a tab with no opener, and
  // Coinbase shows "this app doesn't support smart wallets".
  const [plan, setPlan] = useState<BuyPlan | null>(null);
  const [editing, setEditing] = useState(false);
  const [locked, setLocked] = useState<Set<number>>(new Set());

  const scrollRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const sizerRef = useRef<HTMLSpanElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const amtRef = useRef<HTMLInputElement>(null);
  const amtSizerRef = useRef<HTMLSpanElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
  const started = useRef(false);
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      started.current = false; // strict-mode remount (dev) or a real remount: allow the deep link to build again
    },
    [],
  );

  const tokenCount = getTokens().length;
  const thinking = [
    "Reading what you want, and what you don't",
    `Screening ${tokenCount} tokenized stocks on Base`,
    // Liquidity is not checked anywhere in v0; that arrives with 0x in Fase 2.
    "Sizing the basket",
  ];

  const build = useCallback(
    (text: string) => {
      const t = text.trim();
      if (!t) { promptRef.current?.focus(); return; }
      setPrompt(t);

      // The baskets that ship with the build are already here, in memory, before the tap
      // lands. Nothing is being computed, so there is nothing to wait for: go straight to
      // the basket. A loading screen that flashes for half a second is worse than none.
      const ready = lookupPrecomputed(t);
      if (ready) {
        setOffline(false);
        setBasket(toEditable(ready));
        setPhase("idle");
        setThinkIdx(-1);
        setStep(2);
        return;
      }

      setPhase("thinking");
      setThinkIdx(0);
      promptRef.current?.blur();

      const fast = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const ms = fast ? 10 : THINKING_MS;
      // The steps walk forward on their own but stop on the last one, which keeps
      // spinning until the model actually answers. The wait is real, so don't fake it.
      thinking.forEach((_, i) => {
        if (i < thinking.length - 1) later(() => setThinkIdx(i), i * ms);
      });
      later(() => setThinkIdx(thinking.length - 1), (thinking.length - 1) * ms);

      const started = Date.now();
      const finish = (b: MockBasket) => {
        const elapsed = Date.now() - started;
        // Something answered sooner than the animation could get through its steps (a
        // repeat prompt served from memory). Cut it short rather than stall on purpose.
        const full = thinking.length * ms;
        const minimum = fast ? 0 : Math.max(0, (elapsed < 400 ? 320 : full) - elapsed);
        later(() => {
          setThinkIdx(thinking.length);
          later(() => { setBasket(b); setPhase("idle"); setStep(2); }, fast ? 10 : 200);
        }, minimum);
      };

      requestBasket(t)
        .then((r) => { setOffline(false); finish(toEditable(r.basket)); })
        // The regex parser is offline and instant: a dead API still gets a basket. Say so
        // rather than passing a keyword match off as the model's answer.
        .catch(() => { setOffline(true); finish(parsePrompt(t, owned)); });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [owned],
  );

  // Two deep links. ?q= runs a prompt on arrival; ?add= tops up an index you already own,
  // which needs no model call and no basket review, so it lands straight on the amount.
  useEffect(() => {
    if (started.current) return;
    // Someone came back to a purchase that already happened: there is nothing to redo.
    if (params.get("done")) { router.replace("/"); return; }
    const add = params.get("add");
    if (add) {
      const existing = owned.find((o) => o.id === add);
      if (existing) {
        started.current = true;
        setBasket({
          name: existing.name,
          picks: [...existing.picks],
          weights: [...existing.weights],
          excluded: [],
          note: "Adding to the index you already own. Same stocks, same weights.",
        });
        setStep(3);
        return;
      }
    }
    const q = params.get("q");
    if (q) { started.current = true; build(q); }
  }, [params, build, owned, router, real]);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [step]);

  /**
   * The steps live in history, so the system back gesture walks them instead of leaving
   * the wizard and dropping the basket. The first step owns no entry: going back from it
   * leaves, which is what a person expects.
   */
  const stepRef = useRef(step);
  useEffect(() => {
    if (step > stepRef.current && !(prefilled && step === 2)) window.history.pushState({ wizardStep: step }, "");
    stepRef.current = step;
  }, [step]);
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const s = (e.state as { wizardStep?: number } | null)?.wizardStep;
      setStep(s === 2 || s === 3 ? s : prefilled ? 2 : 1);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // The amount input is sized from a hidden twin of its text, in the same font. A `ch`
  // estimate clipped the last digit on the phone while the keyboard was up.
  useLayoutEffect(() => {
    if (!editingAmt || !amtSizerRef.current || !amtRef.current) return;
    amtSizerRef.current.textContent = amtText || "0";
    amtRef.current.style.width = Math.ceil(amtSizerRef.current.getBoundingClientRect().width) + 12 + "px";
  }, [editingAmt, amtText]);

  // Editable title: width follows the text, as in the mock.
  useLayoutEffect(() => {
    if (step !== 2 || !sizerRef.current || !titleRef.current) return;
    sizerRef.current.textContent = basket?.name || " ";
    titleRef.current.style.width = sizerRef.current.offsetWidth + 8 + "px";
  }, [step, basket?.name]);

  const setWeight = (i: number, v: number) => {
    if (!basket) return;
    const [lo, hi] = dragRange(basket.weights, i, locked);
    const ws = [...basket.weights];
    ws[i] = Math.min(hi, Math.max(lo, v));
    const next = rebalance(ws, new Set([...locked, i]));
    if (!next) { toast("Unlock a slice to move this one"); return; }
    setBasket({ ...basket, weights: next });
  };
  const toggleLock = (i: number) => {
    const next = new Set(locked);
    if (next.has(i)) next.delete(i); else next.add(i);
    setLocked(next);
  };
  const remove = (i: number) => {
    if (!basket) return;
    if (basket.picks.length <= 3) { toast("Keep at least 3 stocks"); return; }
    const picks = basket.picks.filter((_, k) => k !== i);
    const weights = rebalance(basket.weights.filter((_, k) => k !== i)) ?? capWeightsFor(picks);
    setLocked(new Set());
    setBasket({ ...basket, picks, weights });
  };

  // With a wallet the balance takes a moment to arrive; until it does, nothing is "short".
  const balanceLoading = real && wallet.usdc === null;
  // With a wallet the spendable USDC is the balance minus the gas reserve.
  const spendable = real ? Math.max(0, Math.floor((cash - GAS_RESERVE_USD) * 100) / 100) : cash;
  const short = balanceLoading ? false : amount > spendable;
  const ctaDisabled = phase === "buying" || (step === 3 && (amount < 1 || short || balanceLoading || (real && !plan)));
  const hint =
    step === 3 && real && !short && amount >= 1
      ? "One transaction on Base, signed in Coinbase. Pool fee 0.05% per stock."
      : step === 2
      ? editing
        ? "Drag a bar to change a weight, tap a percentage to lock it."
        : "Weights are sized for you. Edit them if you like, tap the title to rename."
      : short
        ? real
          ? amount <= cash
            ? `Max is ${money(spendable)}: ${money(GAS_RESERVE_USD)} is set aside for gas.`
            : "Not enough USDC. Add funds or lower the amount."
          : "Not enough USDC. Add funds or lower the amount."
        : amount < 1
          ? real && spendable < 1
            ? `You need at least ${money(1 + GAS_RESERVE_USD)}: the $1 minimum, plus ${money(GAS_RESERVE_USD)} set aside for gas. Add USDC to go long.`
            : "Enter at least $1."
          : "One transaction on Base. You'll see it on Basescan.";

  // Price the basket whenever what's being bought changes, and again every four minutes
  // so the swap's ten-minute deadline never goes stale under a slow thumb.
  const address = wallet.address;
  const picksKey = basket ? basket.picks.map((p, i) => `${p}:${basket.weights[i]}`).join(",") : "";
  useEffect(() => {
    if (!real || step !== 3 || !basket || !address || amount < 1) { setPlan(null); return; }
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const price = () => {
      setPlan(null);
      planBuy({ recipient: address, usd: amount, picks: basket.picks.map((symbol, i) => ({ symbol, weight: basket.weights[i] ?? 0 })) })
        .then((p) => { if (live) { setPlan(p); timer = setTimeout(price, 4 * 60_000); } })
        .catch((e) => { if (live) toast(`Couldn't price this: ${String((e as Error).message).slice(0, 80)}`); });
    };
    const debounce = setTimeout(price, 350);
    return () => { live = false; clearTimeout(debounce); if (timer) clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [real, step, address, amount, picksKey]);

  /** The real thing: one signature for the priced batch, then wait for Base. */
  const buyOnBase = async () => {
    if (!basket || !address || !plan) return;
    setPhase("buying");
    try {
      setBuyLabel("Confirm in Coinbase…");
      // Leave the intent so the server can record the purchase from the chain if this
      // tab never comes back. Not awaited: the popup has to open inside the tap.
      void fetch("/api/intents", {
        method: "POST", headers: { "content-type": "application/json" }, keepalive: true,
        body: JSON.stringify({ owner: address, name: basket.name, picks: basket.picks, weights: basket.weights, usd: amount }),
      }).catch(() => {});
      const { id } = await sendCallsAsync({ calls: plan.calls });
      setBuyLabel("Swapping on Base…");
      const result = await waitForCallsStatus(config, { id, timeout: 180_000 });
      const hash = result.receipts?.[0]?.transactionHash;
      if (result.status !== "success" || !hash) throw new Error("The transaction did not go through. Nothing was spent.");
      // The server reads the units from the receipt itself and keeps the record; a failure
      // here is a failure to remember, not to buy — the stocks are in the wallet either way.
      try {
        await recordPurchase({
          owner: address, tx: hash, indexId: topUp ? (addToId ?? undefined) : undefined,
          name: basket.name, picks: basket.picks, weights: basket.weights, usd: amount,
        });
        await invalidateRecord(address);
      } catch (e) {
        console.error("record purchase:", e);
        toast("Bought, but couldn't save the index. It's in your wallet under stocks.");
      }
      setSuccess({ name: basket.name, tx: hash, real: true });
      // This wizard already did its job: the deep-link effect must not treat the marker
      // we just set as "someone came back to a finished purchase" and bounce to Home.
      started.current = true;
      window.history.replaceState(null, "", "/build?done=1");
      void queryClient.invalidateQueries();
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      toast(/rejected|denied|cancel/i.test(msg) ? "Cancelled. Nothing was spent." : (msg.split("\n")[0] ?? "Something failed").slice(0, 100));
    } finally {
      setPhase("idle");
      setBuyLabel(null);
    }
  };

  const next = () => {
    if (!basket) return;
    if (step === 2) { setEditing(false); setStep(3); return; }
    if (real) {
      if (!consent.given) { setAskConsent(true); return; }
      void buyOnBase();
      return;
    }
    setPhase("buying");
    setBuyLabel("Signing…");
    later(() => {
      setBuyLabel("Minting on Base…");
      later(() => {
        buy(basket, amount, addToId ?? undefined);
        setSuccess({ name: basket.name, tx: txHash() });
        // Leave a spent marker in history. Without it, back-from-the-receipt lands on
        // this same screen with the buy button armed, and one tap buys again.
        // This wizard already did its job: the deep-link effect must not treat the marker
      // we just set as "someone came back to a finished purchase" and bounce to Home.
      started.current = true;
      window.history.replaceState(null, "", "/build?done=1");
        setPhase("idle");
        setBuyLabel(null);
      }, 900);
    }, 900);
  };

  const addToId = params.get("add");
  // Resolved, not just present: a stale link should degrade to the normal wizard.
  // The demo's indices are not the wallet's: with a wallet there is nothing to top up
  // until indices are saved (M5), so the link degrades to the normal wizard.
  const topUp = addToId !== null && owned.some((o) => o.id === addToId);
  const back = () => {
    // A top-up has no steps behind it: its basket was decided before we got here.
    if (prefilled && step === 2) { if (window.history.length > 1) window.history.back(); else router.push("/"); return; }
    if (step > 1 && !topUp) window.history.back();
    else router.push("/");
  };

  const changeAmount = (v: number) => setAmount(Math.max(0, Math.round(v * 100) / 100));
  const amtView = amount % 1 ? amount.toFixed(2) : String(amount);
  const excludedNames = basket?.excluded.map((s) => findBySymbol(s)?.name ?? s) ?? [];

  return (
    <section className={"screen" + (step > 1 ? " wiz-focus" : "")}>
      <div className="topbar">
        <button className="link" onClick={back}>‹ Back</button>
        <span className="eyebrow">{topUp ? "Adding to your index" : prefilled ? `Step ${step - 1} of 2` : `Step ${step} of 3`}</span>
        <span style={{ width: 44 }} />
      </div>
      <div className="scroll" ref={scrollRef}>
        {!topUp && <div className="steps">{(prefilled ? [2, 3] : [1, 2, 3]).map((n) => <i key={n} className={n <= step ? "on" : ""} />)}</div>}

        {step === 1 && (
          <div>
            <h1 style={{ fontSize: 26, letterSpacing: "-.01em" }}>What do you want to own?</h1>
            <p className="muted" style={{ margin: "8px 0 18px" }}>Say it like you&apos;d say it to a friend. Include what you <em>don&apos;t</em> want, too.</p>
            <div className="prompt-box">
              <textarea
                ref={promptRef}
                rows={2}
                maxLength={MAX_PROMPT}
                placeholder="e.g. AI without Zuckerberg"
                value={prompt}
                disabled={phase === "thinking"}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); build(prompt); } }}
              />
              <button className="send" aria-label="Build index" disabled={phase === "thinking" || !prompt.trim()} onClick={() => build(prompt)}><ArrowIcon /></button>
            </div>
            {prompt.length > MAX_PROMPT - 40 && (
              <p className="tiny" style={{ textAlign: "right", marginTop: 6 }}>
                {MAX_PROMPT - prompt.length} characters left
              </p>
            )}
            {phase !== "thinking" && (
              <div className="section">
                <div className="eyebrow" style={{ marginBottom: 10 }}>Try one</div>
                <div className="chips">
                  {SUGGEST.map((s) => <button key={s} className="chip" onClick={() => build(s)}>{s}</button>)}
                </div>
              </div>
            )}
            {phase === "thinking" && (
              <ol className="thinking">
                {thinking.map((label, i) => (
                  <li key={label} className={i < thinkIdx ? "done" : i === thinkIdx ? "doing" : ""}><i />{label}</li>
                ))}
              </ol>
            )}
          </div>
        )}

        {step === 2 && basket && (
          <div>
            <label className="title-edit">
              <span className="sizer" ref={sizerRef} aria-hidden="true" />
              <input
                ref={titleRef}
                maxLength={28}
                value={basket.name}
                aria-label="Index name"
                spellCheck={false}
                onChange={(e) => setBasket({ ...basket, name: e.target.value })}
                onBlur={(e) => { if (!e.target.value.trim()) setBasket({ ...basket, name: "Your index" }); }}
                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
              />
              <PencilIcon />
            </label>
            <div className={"ai-note" + (offline ? " ai-note-offline" : "")}>
              <span className="spark-ic">{offline ? "!" : "✦"}</span>
              <span>{offline ? "We couldn't reach the AI, so this is a starting point from your words. Edit it, or try again." : basket.note}</span>
            </div>
            <div className="excluded">
              {excludedNames.length > 0 && <span className="tiny">Excluded:</span>}
              {excludedNames.map((n) => <span key={n} className="x">{n}</span>)}
            </div>
            <div className="tools">
              <span className="tiny">{editing ? `Each slice stays between ${W_MIN}% and ${W_MAX}%.` : "Sized by market cap, max 35% each."}</span>
              <button className={"chip" + (editing ? " on" : "")} onClick={() => setEditing((e) => !e)}>{editing ? "Done" : "Edit weights"}</button>
            </div>
            <div className="holdings">
              {basket.picks.map((s, i) => (
                <HoldRow
                  key={s}
                  symbol={s}
                  weight={basket.weights[i] ?? 0}
                  onWeight={editing ? (w) => setWeight(i, w) : undefined}
                  onRemove={editing ? () => remove(i) : undefined}
                  locked={locked.has(i)}
                  onToggleLock={editing ? () => toggleLock(i) : undefined}
                />
              ))}
            </div>
            <div className="facts">
              <div className="fact"><span className="eyebrow">Holdings</span><b>{basket.picks.length}</b></div>
              <div className="fact"><span className="eyebrow">Fee</span><b>0.15%<span className="tiny"> /yr</span></b></div>
              <div className="fact"><span className="eyebrow">Rebalance</span><b>Monthly</b></div>
            </div>
          </div>
        )}

        {step === 3 && basket && (
          <div>
            <h1 style={{ fontSize: 24, letterSpacing: "-.01em" }}>How much?</h1>
            {/* On a top-up the basket was chosen elsewhere, so name what the money goes into. */}
            {topUp && (
              <div className="into">
                <span className="icon">
                  <IndexCluster picks={basket.picks} weights={basket.weights} seed={basket.name} size={31} />
                </span>
                <span>Into <b>{basket.name}</b></span>
              </div>
            )}
            <div className="amount">
              {editingAmt ? (
                <label className="big"><span>$</span>
                  <span className="amt-sizer" ref={amtSizerRef} aria-hidden="true" />
                  <input
                    ref={amtRef}
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*[.,]?[0-9]*"
                    value={amtText}
                    placeholder="0"
                    autoFocus
                    style={{ position: "static", opacity: 1, pointerEvents: "auto", width: `${Math.max(2, amtText.length + 1)}ch`, minWidth: "1.2ch", border: 0, background: "none", font: "inherit", color: "inherit", outline: "none", caretColor: "transparent" } as CSSProperties}
                    onChange={(e) => {
                      // A text field, not a number one: iOS number inputs pad and clip the
                      // big digits, and a Spanish keyboard types a comma for the decimal.
                      const raw = e.target.value.replace(",", ".").replace(/[^0-9.]/g, "");
                      const clean = raw.replace(/(\..*)\./g, "$1");
                      setAmtText(clean);
                      changeAmount(Number(clean) || 0);
                    }}
                    onBlur={() => setEditingAmt(false)}
                  />
                </label>
              ) : (
                <button className="big" onClick={() => { setAmtText(amtView); setEditingAmt(true); }} aria-label="Edit amount"><span>$</span>{amtView}</button>
              )}
            </div>
            <div className="presets">
              {PRESETS.map((p) => (
                <button key={p} className={"chip" + (p === amount ? " on" : "")} onClick={() => changeAmount(p)}>${p}</button>
              ))}
              {real && (
                <button className={"chip" + (amount === spendable && spendable > 0 ? " on" : "")} disabled={balanceLoading} onClick={() => changeAmount(spendable)}>Max</button>
              )}
            </div>
            <div className="eyebrow" style={{ margin: "24px 0 8px" }}>Pay with</div>
            <div className="pay">
              <div className="pay-opt on">
                <span className="logo usdc"><img src="/img/usdc.png" alt="USDC" /><i>USDC</i></span>
                <span><span className="t">USDC balance</span><br /><span className="s">On Base · instant</span></span>
                <span className="r num">{money(cash)}</span>
              </div>
            </div>
            <div className="receipt">
              <div><span>You go long with</span><b className="num">{money(amount)}</b></div>
              {real ? (
                <>
                  <div><span>Long fee · 0.5%</span><b className="num">{money(amount * 0.005)}</b></div>
                  <div><span>Pool fee</span><b className="num">0.05% per stock</b></div>
                </>
              ) : (
                <div><span>Network + issuer fee</span><b className="num">$0.12</b></div>
              )}
              <div><span>{real ? "Stocks bought" : "Tokens minted"}</span><b>{basket.picks.length} stocks</b></div>
              <div><span>Settlement</span><b>Seconds, on Base</b></div>
            </div>
          </div>
        )}
      </div>

      {step > 1 && (
        <div className="footer-cta">
          <button
            className={"btn btn-primary btn-lg" + (ctaDisabled ? " btn-off" : "")}
            aria-disabled={ctaDisabled}
            onClick={() => {
              if (!ctaDisabled) { next(); return; }
              if (phase === "buying" || (real && !plan && !short && amount >= 1)) return; // busy, not wrong
              setNudge(false);
              requestAnimationFrame(() => setNudge(true));
            }}
          >
            {buyLabel ?? (step === 2 ? "Looks good" : balanceLoading ? "Checking balance…" : real && !plan && amount >= 1 && !short ? "Pricing…" : "Go long")}
          </button>
          <div className={"hint" + (nudge ? " hint-err" : "")} onAnimationEnd={() => setNudge(false)}>{hint}</div>
        </div>
      )}

      <ConsentSheet open={askConsent} onClose={() => setAskConsent(false)} onAccept={consent.accept} />

      {success && (
        <div className="success">
          <Confetti />
          <div className="check"><CheckIcon /></div>
          <h1>You&apos;re long.</h1>
          <p>{success.name} is in your wallet. Welcome to the long side.</p>
          {success.real ? (
            <a className="tx" href={`https://basescan.org/tx/${success.tx}`} target="_blank" rel="noreferrer">
              <BaseBadge /><code>{shortHash(success.tx)}</code><span className="tiny">Basescan ↗</span>
            </a>
          ) : (
            <button
              className="tx"
              onClick={() => { navigator.clipboard?.writeText(success.tx).then(() => toast("Transaction hash copied"), () => toast(success.tx)); }}
            >
              <BaseBadge /><code>{shortHash(success.tx)}</code><span className="tiny">Copy</span>
            </button>
          )}
          <button className="btn btn-primary" onClick={() => router.push("/")}>Back to portfolio</button>
        </div>
      )}
    </section>
  );
}
