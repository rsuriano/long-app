"use client";
import { Brand, BaseBadge } from "./Brand";
import type { WalletState } from "@/lib/useWallet";

/**
 * First screen when there is no wallet: one real way in (Coinbase Smart Wallet, passkey)
 * and a quiet way to look around on mock data. Nothing here touches the mock store.
 */
export function WelcomeScreen({ wallet, onDemo }: { wallet: WalletState; onDemo: () => void }) {
  return (
    <section className="screen welcome">
      <div className="topbar"><Brand /><BaseBadge /></div>
      <div className="welcome-body">
        <h1>Your own index.<br />One transaction.</h1>
        <p className="muted">Describe the stocks you believe in. Long builds the basket and buys it on Base as tokenized stocks, with USDC.</p>
      </div>
      <div className="welcome-actions">
        <button className="btn btn-primary btn-lg" onClick={() => wallet.connect()} disabled={wallet.isConnecting}>
          {wallet.isConnecting ? "Opening Coinbase…" : "Connect wallet"}
        </button>
        {wallet.error && <span className="tiny welcome-err">{wallet.error}</span>}
        <button className="welcome-demo" onClick={onDemo}>Try the demo</button>
        <span className="welcome-hint">Coinbase Smart Wallet · passkey, no seed phrase</span>
      </div>
    </section>
  );
}
