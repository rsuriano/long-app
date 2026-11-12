import { NextResponse } from "next/server";
import { isAddress, isHash, type Address, type Hex } from "viem";
import { MAX_PICKS, MIN_PICKS, findBySymbol } from "@long/universe";
import { hasDatabase } from "@/lib/server/db";
import { savePurchase } from "@/lib/server/purchases";
import { settleIntent } from "@/lib/server/intents";

/**
 * Records a purchase. There is no login yet: the server trusts nothing but the chain. It
 * reads the transaction, takes the units from the Transfer events to the owner, and only
 * then writes. Name and weights are the caller's; a bad name is the worst a stranger can do.
 */
export const runtime = "nodejs";
export const maxDuration = 30;

type Body = { owner?: unknown; tx?: unknown; indexId?: unknown; name?: unknown; picks?: unknown; weights?: unknown; usd?: unknown };

export async function POST(request: Request) {
  let b: Body;
  try {
    b = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "expected a JSON body" }, { status: 400 });
  }
  const { owner, tx, indexId, name, picks, weights, usd } = b;
  if (typeof owner !== "string" || !isAddress(owner)) return NextResponse.json({ error: "owner must be an address" }, { status: 400 });
  if (typeof tx !== "string" || !isHash(tx)) return NextResponse.json({ error: "tx must be a transaction hash" }, { status: 400 });
  if (typeof name !== "string" || !name.trim() || name.length > 60) return NextResponse.json({ error: "name is required (max 60)" }, { status: 400 });
  if (!Array.isArray(picks) || picks.length < MIN_PICKS || picks.length > MAX_PICKS || !picks.every((s) => typeof s === "string" && findBySymbol(s)))
    return NextResponse.json({ error: "picks must be known stocks" }, { status: 400 });
  if (!Array.isArray(weights) || weights.length !== picks.length || !weights.every((w) => Number.isInteger(w) && w > 0))
    return NextResponse.json({ error: "weights must match picks" }, { status: 400 });
  if (typeof usd !== "number" || !(usd > 0) || usd > 1_000_000) return NextResponse.json({ error: "usd must be a positive number" }, { status: 400 });
  if (indexId !== undefined && typeof indexId !== "string") return NextResponse.json({ error: "indexId must be a string" }, { status: 400 });
  if (!hasDatabase()) return NextResponse.json({ error: "no database configured" }, { status: 503 });

  try {
    const saved = await savePurchase({
      owner: owner as Address, tx: tx as Hex, indexId: indexId as string | undefined, name: name.trim(),
      picks: picks.map((s) => findBySymbol(s as string)!.symbol), weights: weights as number[], usd,
    });
    await settleIntent(owner, name.trim(), tx).catch(() => {});
    return NextResponse.json(saved);
  } catch (e) {
    const msg = (e as Error).message;
    console.error("purchases:", msg);
    const known = /transaction failed|sent no stocks|unknown stock/.test(msg);
    return NextResponse.json({ error: known ? msg : "could not save the purchase" }, { status: known ? 422 : 500 });
  }
}
