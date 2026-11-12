import { Brand } from "@/components/Brand";

export const metadata = { title: "Long — not available here" };

/** Shown, with a 451, to visitors from a blocked country. Static: no wallet, no store. */
export default function Page() {
  return (
    <section className="screen welcome">
      <div className="topbar"><Brand /></div>
      <div className="welcome-body">
        <h1>Not available<br />where you are.</h1>
        <p className="muted">
          Tokenized stocks on Base are offered only to eligible people outside the United States. Long follows the
          same rule, so there is nothing to see from here.
        </p>
      </div>
      <div className="welcome-actions">
        <span className="welcome-hint">Long is the app. Coinbase issues the tokens; Alpaca Securities custodies the shares.</span>
      </div>
    </section>
  );
}
