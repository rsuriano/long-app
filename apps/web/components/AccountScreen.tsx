"use client";
import { useRouter } from "next/navigation";
import { useWallet } from "@/lib/useWallet";
import { useHoldings } from "@/lib/useHoldings";
import { useDemoMode } from "@/lib/demo";
import { useTheme } from "@/lib/theme";
import { useStore } from "@/lib/store";
import { useCopy } from "@/lib/useCopy";
import { money } from "@/lib/format";
import { avatarStyle } from "./AccountAvatar";

/**
 * What the app knows about the account, and the way out. With a wallet: the address and
 * what's in it. In the demo: how to leave the demo. Both: the theme. Kept as bare as the
 * Home: this is a settings screen, not a dashboard.
 */
export function AccountScreen() {
  const router = useRouter();
  const wallet = useWallet();
  const live = useHoldings(wallet.address);
  const { exitDemo } = useDemoMode();
  const { dark, set } = useTheme();
  const { toast } = useStore();

  const clip = useCopy();
  const copy = async () => {
    if (!wallet.address) return;
    if (!(await clip.copy(wallet.address))) toast("Couldn't copy — long-press the address instead");
  };
  const logout = () => {
    wallet.disconnect();
    exitDemo();
    router.push("/");
  };

  const short = wallet.address ? `${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}` : null;

  return (
    <section className="screen">
      <div className="topbar">
        <button className="link" onClick={() => router.push("/")}>‹ Home</button>
        <span className="eyebrow">Account</span>
        <span style={{ width: 44 }} />
      </div>
      <div className="scroll">
        <div className="acct-head">
          <span className="avatar avatar-lg" style={avatarStyle(wallet.address)} />
          {wallet.isConnected ? (
            <>
              <button className={"acct-addr" + (clip.copied ? " copied" : "")} onClick={copy}>
                <code>{clip.copied ? "Copied ✓" : short}</code>
                <span className="tiny">{clip.copied ? "Full address is on your clipboard" : "Tap to copy"}</span>
              </button>
              <span className="tiny">Coinbase Smart Wallet</span>
            </>
          ) : (
            <>
              <b>Demo account</b>
              <span className="tiny">Sample data. Nothing here is on-chain.</span>
            </>
          )}
        </div>

        {wallet.isConnected && (
          <div className="section">
            <div className="kv">
              <div><span>USDC</span><b className="num">{wallet.usdc !== null ? money(wallet.usdc) : "…"}</b></div>
              <div><span>Stocks</span><b className="num">{live.isLoading ? "…" : `${live.holdings.length} · ${money(live.totalUsd)}`}</b></div>
              <div>
                <span>On Basescan</span>
                <a href={`https://basescan.org/address/${wallet.address}`} target="_blank" rel="noreferrer">Open ↗</a>
              </div>
            </div>
          </div>
        )}

        <div className="section">
          <div className="section-head"><h2>Appearance</h2></div>
          <div className="seg">
            <button className={!dark ? "on" : ""} onClick={() => set("light")}>Light</button>
            <button className={dark ? "on" : ""} onClick={() => set("dark")}>Dark</button>
          </div>
        </div>

        <div className="section acct-actions">
          {wallet.isConnected ? (
            <button className="btn btn-ghost btn-lg" onClick={logout}>Log out</button>
          ) : (
            <>
              <button className="btn btn-primary btn-lg" onClick={() => wallet.connect()} disabled={wallet.isConnecting}>
                {wallet.isConnecting ? "Opening Coinbase…" : "Connect wallet"}
              </button>
              <button className="btn btn-ghost btn-lg" onClick={logout}>Leave the demo</button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
