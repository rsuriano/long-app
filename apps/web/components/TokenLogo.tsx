"use client";
import { useEffect, useRef, useState } from "react";
import { DARK_VARIANTS } from "@/lib/logos";

/**
 * Company logo for a ticker, served from /public/logos/{TICKER}.png.
 * Falls back to a monogram badge when the file is missing, so a new token in the
 * universe never breaks the UI.
 */
export function TokenLogo({ ticker, size, mono = "ticker" }: { ticker: string; size: number; mono?: "ticker" | "initial" }) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  // A server-rendered <img> can fail before hydration, so onError never fires: check on mount.
  useEffect(() => {
    const el = ref.current;
    if (el && el.complete && el.naturalWidth === 0) setFailed(true);
  }, []);
  if (failed) {
    return (
      <span className="tlogo mono" style={{ width: size, height: size, fontSize: mono === "ticker" ? Math.max(9, size * 0.3) : size * 0.5 }}>
        {mono === "ticker" ? ticker : ticker[0]}
      </span>
    );
  }
  return (
    <span className="tlogo" style={{ width: size, height: size }}>
      <img ref={ref} className="light" src={`/logos/${ticker}.png`} alt="" onError={() => setFailed(true)} />
      {DARK_VARIANTS.has(ticker) && <img className="dark" src={`/logos/${ticker}.dark.png`} alt="" />}
    </span>
  );
}
