import { NextResponse } from "next/server";
import { isAddress, type Address } from "viem";
import { MAX_PICKS, MIN_PICKS, findBySymbol } from "@long/universe";
import { hasDatabase } from "@/lib/server/db";
import { createIntent } from "@/lib/server/intents";

/** "About to buy this": left before the signature, reconciled from the chain if the browser never comes back. */
export const runtime = "nodejs";

export async function POST(request: Request) {
  let b: { owner?: unknown; name?: unknown; picks?: unknown; weights?: unknown; usd?: unknown };
  try {
    b = await request.json();
  } catch {
    return NextResponse.json({ error: "expected a JSON body" }, { status: 400 });
  }
  const { owner, name, picks, weights, usd } = b;
  if (typeof owner !== "string" || !isAddress(owner)) return NextResponse.json({ error: "owner must be an address" }, { status: 400 });
  if (typeof name !== "string" || !name.trim() || name.length > 60) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!Array.isArray(picks) || picks.length < MIN_PICKS || picks.length > MAX_PICKS || !picks.every((s) => typeof s === "string" && findBySymbol(s)))
    return NextResponse.json({ error: "picks must be known stocks" }, { status: 400 });
  if (!Array.isArray(weights) || weights.length !== picks.length || !weights.every((w) => Number.isInteger(w) && w > 0))
    return NextResponse.json({ error: "weights must match picks" }, { status: 400 });
  if (typeof usd !== "number" || !(usd > 0) || usd > 1_000_000) return NextResponse.json({ error: "usd must be positive" }, { status: 400 });
  if (!hasDatabase()) return NextResponse.json({ error: "no database configured" }, { status: 503 });
  try {
    const r = await createIntent({ owner: owner as Address, name: name.trim(), picks: picks.map((s) => findBySymbol(s as string)!.symbol), weights: weights as number[], usd });
    return NextResponse.json({ id: r.id });
  } catch (e) {
    console.error("intents:", (e as Error).message);
    return NextResponse.json({ error: "could not save the intent" }, { status: 500 });
  }
}
