"use client";
import { useState } from "react";
import { useConfig, useSendCalls } from "wagmi";
import { waitForCallsStatus } from "wagmi/actions";
import { encodeFunctionData, erc20Abi, isAddress, parseUnits, type Address } from "viem";
import { USDC_BASE } from "@long/execution";
import { money, shortHash } from "@/lib/format";
import { useWallet } from "@/lib/useWallet";
import { useStore } from "@/lib/store";
import { GAS_RESERVE_USD } from "./BuildWizard";
import { BaseBadge } from "./Brand";
import { CheckIcon } from "./icons";
import { Overlay } from "./Overlay";

/**
 * Cash out: USDC from the wallet to any address on Base, one signature. There is no
 * pricing to do, so the tap that asks for the signature does nothing else first.
 */
export function WithdrawForm({ onDone }: { onDone: () => void }) {
  const wallet = useWallet();
  const config = useConfig();
  const { sendCallsAsync } = useSendCalls();
  const { toast } = useStore();
  const [to, setTo] = useState("");
  const [amt, setAmt] = useState("");
  const [label, setLabel] = useState<string | null>(null);
  const [done, setDone] = useState<{ usd: number; tx: string } | null>(null);

  const balance = wallet.usdc ?? 0;
  const amount = Number(amt.replace(",", ".")) || 0;
  const toOk = isAddress(to.trim());
  const isSelf = toOk && wallet.address && to.trim().toLowerCase() === wallet.address.toLowerCase();
  // "All" leaves the gas reserve behind, for the same reason as a buy (see GAS_RESERVE_USD).
  const spendable = Math.max(0, Math.floor((balance - GAS_RESERVE_USD) * 100) / 100);
  const short = amount > spendable + 1e-9;
  const canSend = toOk && !isSelf && amount > 0 && !short && label === null;
  const setPart = (p: number) => setAmt((Math.floor(spendable * p * 100) / 100).toFixed(2));

  const send = async () => {
    if (!canSend) return;
    try {
      setLabel("Confirm in Coinbase…");
      const data = encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [to.trim() as Address, parseUnits(amount.toFixed(6), 6)] });
      const { id } = await sendCallsAsync({ calls: [{ to: USDC_BASE, data }] });
      setLabel("Sending on Base…");
      const result = await waitForCallsStatus(config, { id, timeout: 180_000 });
      const hash = result.receipts?.[0]?.transactionHash;
      if (result.status !== "success" || !hash) throw new Error("The transfer did not go through. Nothing was sent.");
      setDone({ usd: amount, tx: hash });
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      toast(/rejected|denied|cancel/i.test(msg) ? "Cancelled. Nothing was sent." : (msg.split("\n")[0] ?? "Something failed").slice(0, 100));
    } finally {
      setLabel(null);
    }
  };

  if (done) {
    return (
      <Overlay><div className="success success-calm">
        <div className="check check-calm"><CheckIcon /></div>
        <h1>Sent.</h1>
        <p><b className="num">{money(done.usd)}</b> USDC is on its way to {shortHash(to.trim())}, on Base.</p>
        <a className="tx" href={`https://basescan.org/tx/${done.tx}`} target="_blank" rel="noreferrer">
          <BaseBadge /><code>{shortHash(done.tx)}</code><span className="tiny">Basescan ↗</span>
        </a>
        <button className="btn btn-primary" onClick={() => { setDone(null); setTo(""); setAmt(""); onDone(); }}>Back to portfolio</button>
      </div></Overlay>
    );
  }

  return (
    <div className="withdraw">
      <label className="field">
        <span className="eyebrow">To · a Base address</span>
        <input
          className="field-input mono"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="0x…"
          autoCapitalize="off" autoCorrect="off" spellCheck={false} inputMode="text"
        />
        {to && !toOk && <span className="tiny welcome-err">That is not an address.</span>}
        {isSelf && <span className="tiny welcome-err">That is this wallet.</span>}
      </label>
      <label className="field">
        <span className="eyebrow">Amount · USDC</span>
        <input
          className="field-input num"
          value={amt}
          onChange={(e) => setAmt(e.target.value.replace(/[^0-9.,]/g, ""))}
          placeholder="0.00"
          inputMode="decimal"
        />
        <span className={"tiny" + (short ? " welcome-err" : "")}>
          {wallet.usdc === null
            ? "Reading balance…"
            : short
              ? `Not enough: you can send up to ${money(spendable)}. ${money(GAS_RESERVE_USD)} is set aside for gas.`
              : `You can send up to ${money(spendable)} · ${money(GAS_RESERVE_USD)} is set aside for gas`}
        </span>
      </label>
      <div className="presets" style={{ justifyContent: "flex-start", marginTop: 8 }}>
        {[0.25, 0.5, 1].map((p) => (
          <button key={p} className="chip" onClick={() => setPart(p)} disabled={wallet.usdc === null}>{p === 1 ? "All" : `${p * 100}%`}</button>
        ))}
      </div>
      <div className="warn" style={{ marginTop: 14 }}>
        <BaseBadge />
        <span>Only to an address that accepts USDC on <b>Base</b>. On an exchange, pick the Base network when you copy the deposit address.</span>
      </div>
      <div className="actions" style={{ gridTemplateColumns: "1fr" }}>
        <button className="btn btn-primary btn-lg" disabled={!canSend} onClick={send}>{label ?? "Send USDC"}</button>
      </div>
    </div>
  );
}
