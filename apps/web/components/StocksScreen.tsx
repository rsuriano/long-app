"use client";
import { getUniverse, type Token } from "@long/universe";
import { Brand } from "./Brand";
import { TokenLogo } from "./TokenLogo";

/**
 * Every stock the app can actually buy, with the contract behind it.
 *
 * The plan is firm that the universe is live data, never a constant: it is 10 today and
 * Coinbase has promised thousands. Showing the real list — and letting anyone check each
 * address on Basescan — is the honest version of "hoy 10, la infraestructura está lista
 * para 1.000", and it is the screen that proves the rest of the app is not invented.
 */
function Row({ token }: { token: Token }) {
  const address = token.address;
  return (
    <div className="stock">
      <span className="stock-logo"><TokenLogo ticker={token.ticker} size={34} /></span>
      <span className="stock-body">
        <b>{token.name}</b>
        <span className="s">{token.blurb}</span>
        <span className="stock-meta">{token.sector} · {token.ceo}</span>
      </span>
      {/* The ticker is the link to the contract: the address itself is one tap away, not on the card. */}
      {address ? (
        <a className="stock-sym" href={`https://basescan.org/token/${address}`} target="_blank" rel="noreferrer" aria-label={`${token.symbol} on Basescan`}>
          {token.symbol}
        </a>
      ) : (
        <code className="stock-sym">{token.symbol}</code>
      )}
    </div>
  );
}

export function StocksScreen() {
  const universe = getUniverse();
  return (
    <section className="screen">
      <div className="topbar">
        <Brand label="Stocks" />
      </div>
      <div className="scroll">
        <p className="muted" style={{ margin: "2px 0 18px" }}>
          Every stock you can hold today, issued by {universe.issuer} on Base and custodied by{" "}
          {universe.custodian}. Coinbase keeps adding to the list, and so does this screen.
        </p>
        <div className="stocks">
          {[...universe.tokens].sort((a, b) => a.name.localeCompare(b.name)).map((t) => <Row key={t.symbol} token={t} />)}
        </div>
        <p className="legal">
          Tap a ticker to open its contract on Basescan. Every address was read from the contract
          itself, so what you buy is what is listed here. Tokenized stocks are available only to eligible users
          outside the United States. Nothing here is investment advice.
        </p>
      </div>
    </section>
  );
}
