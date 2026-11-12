"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Copies text and says so. `copied` stays true for a moment so the button itself can
 * change — a toast alone was not enough for anyone to feel that it worked. The
 * fallback covers plain-http pages (the phone on the LAN), where the async clipboard
 * API does not exist.
 */
export function useCopy(holdMs = 1600) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const copy = useCallback(async (text: string) => {
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch {
      // fall through to the legacy path
    }
    if (!ok) {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      ta.remove();
    }
    if (ok) {
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), holdMs);
    }
    return ok;
  }, [holdMs]);

  return { copy, copied };
}
