import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { hasDatabase } from "@/lib/server/db";
import { listForOwner } from "@/lib/server/purchases";
import { reconcile } from "@/lib/server/intents";

/** Everything a wallet bought through Long. Public data: the chain already shows it. */
export const runtime = "nodejs";

export async function GET(request: Request) {
  const owner = new URL(request.url).searchParams.get("owner") ?? "";
  if (!isAddress(owner)) return NextResponse.json({ error: "owner must be an address" }, { status: 400 });
  if (!hasDatabase()) return NextResponse.json({ error: "no database configured" }, { status: 503 });
  try {
    // Anything the browser meant to buy and never came back to record.
    await reconcile(owner).catch((e) => console.error("reconcile:", (e as Error).message));
    return NextResponse.json(await listForOwner(owner), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("indices:", e);
    return NextResponse.json({ error: "could not read indices" }, { status: 500 });
  }
}
