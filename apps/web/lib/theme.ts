"use client";
import { useCallback, useEffect, useSyncExternalStore } from "react";

const KEY = "long:theme";
type Theme = "light" | "dark";
const listeners = new Set<() => void>();
let current: Theme = "light";

const apply = (t: Theme) => {
  current = t;
  document.documentElement.dataset.theme = t;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Light or dark, remembered per device; falls back to the system setting. */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, () => current, () => "light" as Theme);

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(KEY);
    } catch {
      // blocked storage: use the system preference for this visit
    }
    const dark = saved ? saved === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    if ((dark ? "dark" : "light") !== current) apply(dark ? "dark" : "light");
  }, []);

  const set = useCallback((t: Theme) => {
    apply(t);
    try {
      localStorage.setItem(KEY, t);
    } catch {
      // Private mode or blocked storage: the switch still works for this visit.
    }
  }, []);
  const toggle = useCallback(() => set(current === "dark" ? "light" : "dark"), [set]);
  return { theme, dark: theme === "dark", set, toggle };
}
