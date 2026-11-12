"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { findBySymbol } from "@long/universe";
import type { OwnedIndex } from "./mock-data";

/**
 * An index is app data: the chain only knows tokens. This is the record of what a wallet
 * bought through Long — name, weights, the units each purchase delivered, what it cost —
 * kept on the server, per wallet, and verified against the chain before it is written
 * (see lib/server/purchases.ts). The browser only reads it and asks to record purchases.
 */
export type SavedIndex = {
  id: string;
  name: string;
  picks: string[];
  weights: number[];
  /** Whole units of each stock the purchases delivered, by symbol. */
  units: Record<string, number>;
  /** USDC spent, all purchases together. */
  costUsd: number;
  /** Latest purchase. */
  tx: string;
  createdAt: string;
  updatedAt: string;
};

export type Purchase = { tx: string; indexId: string; name: string; kind: "buy" | "add" | "sell"; usd: number; units: Record<string, number>; at: string };

type Record_ = { indices: SavedIndex[]; purchases: Purchase[] };
const EMPTY: Record_ = { indices: [], purchases: [] };

async function fetchRecord(owner: string): Promise<Record_> {
  const res = await fetch(`/api/indices?owner=${owner}`);
  if (res.status === 503) return EMPTY; // no database in this deployment: nothing saved, nothing broken
  if (!res.ok) throw new Error(`indices: ${res.status}`);
  return (await res.json()) as Record_;
}

function useRecord(owner?: string) {
  return useQuery({
    queryKey: ["record", owner?.toLowerCase() ?? ""],
    queryFn: () => fetchRecord(owner!),
    enabled: !!owner,
    staleTime: 30_000,
  });
}

export function useSavedIndices(owner?: string): { indices: SavedIndex[]; isLoading: boolean } {
  const q = useRecord(owner);
  return { indices: q.data?.indices ?? [], isLoading: !!owner && q.isLoading };
}

export function usePurchases(owner?: string): { purchases: Purchase[]; isLoading: boolean } {
  const q = useRecord(owner);
  return { purchases: q.data?.purchases ?? [], isLoading: !!owner && q.isLoading };
}

/** Asks the server to record a purchase; it verifies the transaction on Base first. */
export async function recordPurchase(p: {
  owner: string; tx: string; indexId?: string; name: string; picks: string[]; weights: number[]; usd: number;
}): Promise<SavedIndex> {
  const res = await fetch("/api/purchases", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(p) });
  const body = (await res.json().catch(() => ({}))) as SavedIndex & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `could not save (${res.status})`);
  return body;
}

/** Asks the server to record a sale; it reads what left and what came back from the transaction. */
export async function recordSale(p: { owner: string; tx: string; indexId: string }) {
  const res = await fetch("/api/sales", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(p) });
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(body.error ?? `could not save (${res.status})`);
}

export function useInvalidateRecord() {
  const qc = useQueryClient();
  return (owner: string) => qc.invalidateQueries({ queryKey: ["record", owner.toLowerCase()] });
}

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short" });

/**
 * The saved index as the Home shows it: valued at today's prices, and its move measured
 * against what it cost — the only history a wallet has until there is a price history.
 */
export function toOwned(saved: SavedIndex[], prices: Map<string, number>): OwnedIndex[] {
  return saved.map((s) => {
    const value = Object.entries(s.units).reduce((a, [sym, u]) => a + u * (prices.get(sym) ?? 0), 0);
    const priced = Object.keys(s.units).every((sym) => prices.has(sym));
    const delta = priced && s.costUsd > 0 ? ((value - s.costUsd) / s.costUsd) * 100 : 0;
    return { id: s.id, name: s.name, picks: s.picks, weights: s.weights, value, delta, created: shortDate(s.createdAt) };
  });
}

/** Units of each stock that no saved index accounts for (bought elsewhere, or sent in). */
export function uncovered<H extends { symbol: string; amount: number }>(saved: SavedIndex[], holdings: H[]): H[] {
  const inIndices = new Map<string, number>();
  for (const s of saved) for (const [sym, u] of Object.entries(s.units)) inIndices.set(sym, (inIndices.get(sym) ?? 0) + u);
  return holdings
    .map((h) => ({ ...h, amount: h.amount - (inIndices.get(h.symbol) ?? 0) }))
    .filter((h) => h.amount * 1e8 > 100 && findBySymbol(h.symbol)); // more than dust
}
