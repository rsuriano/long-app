"use client";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Renders on top of the whole app frame, not inside whatever sheet opened it. A
 * full-screen receipt drawn inside a bottom sheet gets clipped to the sheet.
 */
export function Overlay({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<Element | null>(null);
  useEffect(() => { setHost(document.querySelector(".app") ?? document.body); }, []);
  return host ? createPortal(children, host) : null;
}
