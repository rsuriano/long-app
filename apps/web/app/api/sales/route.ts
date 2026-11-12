import { NextResponse } from "next/server";
import { isAddress, isHash, type Address, type Hex } from "viem";
import { hasDatabase } from "@/lib/server/db";
import { saveSale } from "@/lib/server/purchases";

/** Records a sale, verified from the transaction: what left the wallet, what USDC came back. */
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  let b: { owner?: unknown; tx?: unknown; indexId?: unknown };
  try {
    b = await request.json();
  } catch {
    return NextResponse.json({ error: "expected a JSON body" }, { status: 400 });
  }
  const { owner, tx, indexId } = b;
  if (typeof owner !== "string" || !isAddress(owner)) return NextResponse.json({ error: "owner must be an address" }, { status: 400 });
  if (typeof tx !== "string" || !isHash(tx)) return NextResponse.json({ error: "tx must be a transaction hash" }, { status: 400 });
  if (typeof indexId !== "string" || !indexId) return NextResponse.json({ error: "indexId is required" }, { status: 400 });
  if (!hasDatabase()) return NextResponse.json({ error: "no database configured" }, { status: 503 });
  try {
    const r = await saveSale({ owner: owner as Address, tx: tx as Hex, indexId });
    return NextResponse.json(r ?? { ok: true, duplicate: true });
  } catch (e) {
    const msg = (e as Error).message;
    console.error("sales:", msg);
    const known = /transaction failed|sold no stocks|no such index/.test(msg);
    return NextResponse.json({ error: known ? msg : "could not save the sale" }, { status: known ? 422 : 500 });
  }
}
