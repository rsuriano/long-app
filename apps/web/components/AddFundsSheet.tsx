"use client";
import { useState } from "react";
import { useCopy } from "@/lib/useCopy";
import { BaseBadge } from "./Brand";
import { WithdrawForm } from "./WithdrawForm";

/**
 * How money gets in. Per docs/long-plan.md there is no onramp in v0: Coinbase dropped the
 * ARS/USDC pair, so the honest answer is "send it from where you already have it". ARGt
 * is not offered here until it can be spent (no ARGt/USDC pool yet): a card inviting
 * people to send a token the app cannot use would be a place to park money by mistake.
 *
 * Shows the connected wallet's real address (a real place to send USDC). While no
 * wallet is connected it shows nothing: a placeholder address would be a place to lose
 * money. The same sheet is the way out: Withdraw sends USDC anywhere on Base.
 */
export function AddFundsSheet({ open, onClose, address }: { open: boolean; onClose: () => void; address?: string }) {
  const clip = useCopy();
  const copy = () => { if (address) void clip.copy(address); };
  const [mode, setMode] = useState<"add" | "withdraw">("add");
  return (
    <>
      <div inert={!open} className={"backdrop" + (open ? " on" : "")} onClick={onClose} />
      <div inert={!open} className={"sheet" + (open ? " on" : "")} role="dialog" aria-label="Cash">
        <div className="grab" />
        {address && (
          <div className="seg" style={{ marginBottom: 14 }}>
            <button className={mode === "add" ? "on" : ""} onClick={() => setMode("add")}>Add funds</button>
            <button className={mode === "withdraw" ? "on" : ""} onClick={() => setMode("withdraw")}>Withdraw</button>
          </div>
        )}
        {mode === "withdraw" && address ? (
          <>
            <h2>Withdraw</h2>
            <div className="sub">USDC from your wallet to any address on Base.</div>
            <WithdrawForm onDone={() => { setMode("add"); onClose(); }} />
          </>
        ) : (
        <>
        <h2>Add funds</h2>
        <div className="sub">Send USDC to your wallet on Base.</div>

        {address ? (
          <button className={"acct-addr acct-addr-full" + (clip.copied ? " copied" : "")} onClick={copy} aria-label="Copy address">
            <code>{clip.copied ? "Copied ✓" : address}</code>
            <span className="tiny">{clip.copied ? "Full address is on your clipboard" : "Tap to copy · Base network"}</span>
          </button>
        ) : (
          <div className="addr">
            <div className="addr-mask" aria-hidden="true">
              {Array.from({ length: 3 }, (_, i) => <i key={i} />)}
            </div>
            <span className="tiny">Connect your wallet to see your address.</span>
          </div>
        )}

        <div className="routes">
          <div className="route">
            <span className="route-ic"><img src="/img/usdc.png" alt="" /></span>
            <span>
              <span className="t">Send USDC to this address</span>
              <span className="s">From an exchange or another wallet, on the Base network.</span>
            </span>
          </div>
        </div>

        <div className="warn">
          <BaseBadge />
          <span>Withdraw on <b>Base</b>. Funds sent on another network are lost.</span>
        </div>

        <div className="actions" style={{ gridTemplateColumns: "1fr" }}>
          <button className="btn btn-ghost" onClick={onClose}>Got it</button>
        </div>
        </>
        )}
      </div>
    </>
  );
}
