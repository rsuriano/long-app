"use client";
import { useCallback, useEffect, useSyncExternalStore } from "react";

const KEY = "long.demo";
const listeners = new Set<() => void>();
const read = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};
const write = (on: boolean) => {
  try {
    if (on) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    // private mode: the choice just doesn't survive a reload
  }
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/**
 * "Demo" is the app running on the mock store, chosen from the welcome screen. It is a
 * per-device flag, not a wallet state: connecting a wallet always wins over it.
 */
export function useDemoMode() {
  const demo = useSyncExternalStore(subscribe, read, () => false);
  // `/?demo` is a shareable way in — for a pitch link, and for screenshots.
  useEffect(() => {
    if (new URLSearchParams(location.search).has("demo")) write(true);
  }, []);
  const enterDemo = useCallback(() => write(true), []);
  const exitDemo = useCallback(() => write(false), []);
  return { demo, enterDemo, exitDemo };
}
