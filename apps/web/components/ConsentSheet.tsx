"use client";
import { useState } from "react";

/**
 * The declaration before the first purchase. Plain words, one checkbox, one button. It is
 * asked once per wallet (per version of the text) and recorded server-side.
 */
export function ConsentSheet({ open, onClose, onAccept }: { open: boolean; onClose: () => void; onAccept: () => Promise<void> }) {
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async () => {
    setBusy(true); setError(null);
    try { await onAccept(); onClose(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <>
      <div inert={!open} className={"backdrop" + (open ? " on" : "")} onClick={onClose} />
      <div inert={!open} className={"sheet" + (open ? " on" : "")} role="dialog" aria-label="Before you go long">
        <div className="grab" />
        <h2>Before you go long</h2>
        <div className="sub">One time, for this wallet.</div>
        <ul className="consent-list">
          <li>Tokenized stocks are issued by Coinbase on Base and backed by shares held by Alpaca Securities. Long is the app that builds and buys your index; it never holds your tokens.</li>
          <li>They are not offered to US citizens or residents, nor to anyone in the United States.</li>
          <li>Stocks go up and down. Nothing in Long is investment advice.</li>
        </ul>
        <label className="consent-check">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          <span>I am not a US citizen or resident, I am not in the United States, and I have read the above.</span>
        </label>
        {error && <div className="tiny welcome-err" style={{ marginTop: 8 }}>{error}</div>}
        <div className="actions" style={{ gridTemplateColumns: "1fr" }}>
          <button className="btn btn-primary btn-lg" disabled={!checked || busy} onClick={go}>{busy ? "Saving…" : "I agree"}</button>
        </div>
      </div>
    </>
  );
}
