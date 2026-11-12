"use client";
import { useEffect, useState } from "react";
import { useConfig, useSendCalls } from "wagmi";
import { waitForCallsStatus } from "wagmi/actions";
import { formatUnits } from "viem";
import { planSell, type SellPlan } from "@long/execution";
import { money } from "@/lib/format";
import { useStore } from "@/lib/store";
import { useWallet } from "@/lib/useWallet";
import { recordSale, useInvalidateRecord, type SavedIndex } from "@/lib/indices";
import { shortHash } from "@/lib/format";
import { BaseBadge } from "./Brand";
import { CheckIcon } from "./icons";
import { Overlay } from "./Overlay";

const PARTS = [25, 50, 100];

/**
 * Selling part or all of a real index: one approval and one swap per stock, back to USDC,
 * in one signature. Priced when the sheet opens (and on every change), so the tap that
 * asks for the signature does nothing else first — the popup must open inside the tap.
 */
export function SellSheet({ index, open, onClose }: { index: SavedIndex | null; open: boolean; onClose: () => void }) {
  const wallet = useWallet();
  const config = useConfig();
  const { sendCallsAsync } = useSendCalls();
  const { toast } = useStore();
  const invalidate = useInvalidateRecord();
  const [part, setPart] = useState(100);
  const [plan, setPlan] = useState<SellPlan | null>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [done, setDone] = useState<{ name: string; usd: number; tx: string; all: boolean } | null>(null);
  const address = wallet.address;

  useEffect(() => {
    if (!open || !index || !address) { setPlan(null); return; }
    let live = true;
    setPlan(null);
    planSell({ recipient: address, units: index.units, fraction: part / 100 })
      .then((p) => { if (live) setPlan(p); })
      .catch((e) => { if (live) toast(`Couldn't price this: ${String((e as Error).message).slice(0, 80)}`); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index?.id, index?.updatedAt, part, address]);

  const sell = async () => {
    if (!plan || !index || !address) return;
    try {
      setLabel("Confirm in Coinbase…");
      const { id } = await sendCallsAsync({ calls: plan.calls });
      setLabel("Selling on Base…");
      const result = await waitForCallsStatus(config, { id, timeout: 180_000 });
      const hash = result.receipts?.[0]?.transactionHash;
      if (result.status !== "success" || !hash) throw new Error("The transaction did not go through. Nothing was sold.");
      try {
        await recordSale({ owner: address, tx: hash, indexId: index.id });
      } catch (e) {
        console.error("record sale:", e);
      }
      await invalidate(address);
      setDone({ name: index.name, usd: Number(formatUnits(plan.expectedOut, 6)), tx: hash, all: part === 100 });
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      toast(/rejected|denied|cancel/i.test(msg) ? "Cancelled. Nothing was sold." : (msg.split("\n")[0] ?? "Something failed").slice(0, 100));
    } finally {
      setLabel(null);
    }
  };

  const expected = plan ? Number(formatUnits(plan.expectedOut, 6)) : null;
  const finish = () => { setDone(null); setPart(100); onClose(); };
  return (
    <>
      {/* Quiet, not a party: money came back, and that is fine. */}
      {done && (
        <Overlay><div className="success success-calm">
          <div className="check check-calm"><CheckIcon /></div>
          <h1>Sold.</h1>
          <p>About <b className="num">{money(done.usd)}</b> USDC is back in Available.{done.all ? ` ${done.name} is closed; it stays in your activity.` : ` ${done.name} keeps the rest.`}</p>
          <a className="tx" href={`https://basescan.org/tx/${done.tx}`} target="_blank" rel="noreferrer">
            <BaseBadge /><code>{shortHash(done.tx)}</code><span className="tiny">Basescan ↗</span>
          </a>
          <button className="btn btn-primary" onClick={finish}>Back to portfolio</button>
        </div></Overlay>
      )}
      <div inert={!open} className={"backdrop" + (open ? " on" : "")} onClick={onClose} />
      <div inert={!open} className={"sheet" + (open ? " on" : "")} role="dialog" aria-label="Sell">
        <div className="grab" />
        <h2>Sell</h2>
        <div className="sub">{index ? `${index.name} · back to USDC, one signature` : ""}</div>
        <div className="presets" style={{ justifyContent: "flex-start" }}>
          {PARTS.map((p) => (
            <button key={p} className={"chip" + (p === part ? " on" : "")} onClick={() => setPart(p)}>{p === 100 ? "All" : `${p}%`}</button>
          ))}
        </div>
        <div className="receipt" style={{ marginTop: 16 }}>
          <div><span>You get about</span><b className="num">{expected === null ? "…" : money(expected)}</b></div>
          <div><span>Pool fee</span><b className="num">0.05% per stock</b></div>
          <div><span>Long fee</span><b>None on the way out</b></div>
        </div>
        <div className="actions" style={{ gridTemplateColumns: "1fr" }}>
          <button className="btn btn-primary btn-lg" disabled={!plan || label !== null} onClick={sell}>
            {label ?? (plan ? (part === 100 ? "Sell everything" : `Sell ${part}%`) : "Pricing…")}
          </button>
        </div>
      </div>
    </>
  );
}
