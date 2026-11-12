"use client";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { money, nextIndexId } from "./format";
import { INITIAL_ACTIVITY, INITIAL_CASH, INITIAL_OWNED, type ActivityItem, type OwnedIndex } from "./mock-data";
import type { MockBasket } from "./mock-ai";

/** What the receipt calls "network + issuer fee". Charged, not just displayed. */
export const FEE_USD = 0.12;

type Store = {
  owned: OwnedIndex[];
  cash: number;
  activity: ActivityItem[];
  toastMsg: string | null;
  toast: (msg: string) => void;
  /**
   * Simulated purchase. Fase 2 replaces this with 0x quotes + sendCalls.
   * `addToId` is the explicit top-up path; without it this always creates a new index.
   */
  buy: (basket: MockBasket, amount: number, addToId?: string) => OwnedIndex;
};

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [owned, setOwned] = useState<OwnedIndex[]>(INITIAL_OWNED);
  const [cash, setCash] = useState(INITIAL_CASH);
  const [activity, setActivity] = useState<ActivityItem[]>(INITIAL_ACTIVITY);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToastMsg(null), 1800);
  }, []);

  const buy = useCallback(
    (basket: MockBasket, amount: number, addToId?: string): OwnedIndex => {
      let result: OwnedIndex | undefined;
      setOwned((prev) => {
        // Only ever merge when the person said which index to add to. Matching on the
        // display name silently threw away the basket they had just reviewed, because
        // two different baskets can carry the same name (a curated idea you already own).
        const target = addToId ? prev.find((o) => o.id === addToId) : undefined;
        if (target) {
          result = { ...target, value: target.value + amount };
          return prev.map((o) => (o === target ? result! : o));
        }
        const id = nextIndexId(basket.name, prev.map((o) => o.id));
        result = { id, name: basket.name, picks: [...basket.picks], weights: [...basket.weights], value: amount, delta: 0, created: "today" };
        return [result, ...prev];
      });
      // The receipt promises a fee, so take it.
      setCash((c) => c - amount - FEE_USD);
      setActivity((prev) => [
        { t: "Went long · " + basket.name, s: "USDC → index · today", v: "−" + money(amount), small: money(FEE_USD) + " fee", ic: "📈" },
        ...prev,
      ]);
      return result!;
    },
    [],
  );

  const value = useMemo<Store>(() => ({ owned, cash, activity, toastMsg, toast, buy }), [owned, cash, activity, toastMsg, toast, buy]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside StoreProvider");
  return s;
}
