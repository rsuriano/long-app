"use client";
import { useTheme } from "@/lib/theme";

/** The wordmark. The dot is the theme switch: tap it for light or dark. */
export function Brand({ label = "Long" }: { label?: string }) {
  const { dark, toggle } = useTheme();
  return (
    <div className="brand">
      <button className="dot" onClick={toggle} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} />
      {label}
    </div>
  );
}
export function BaseBadge() {
  return (
    <span className="base-badge">
      <i />Base
    </span>
  );
}
