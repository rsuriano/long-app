import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { hasDatabase } from "@/lib/server/db";
import { CONSENT_VERSION, hasConsent, recordConsent } from "@/lib/server/consent";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const owner = new URL(request.url).searchParams.get("owner") ?? "";
  if (!isAddress(owner)) return NextResponse.json({ error: "owner must be an address" }, { status: 400 });
  if (!hasDatabase()) return NextResponse.json({ ok: false, version: CONSENT_VERSION, unavailable: true });
  try {
    return NextResponse.json({ ok: await hasConsent(owner), version: CONSENT_VERSION }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("consent:", (e as Error).message);
    return NextResponse.json({ error: "could not read consent" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let owner: unknown, accepted: unknown;
  try {
    ({ owner, accepted } = (await request.json()) as { owner?: unknown; accepted?: unknown });
  } catch {
    return NextResponse.json({ error: "expected a JSON body" }, { status: 400 });
  }
  if (typeof owner !== "string" || !isAddress(owner)) return NextResponse.json({ error: "owner must be an address" }, { status: 400 });
  if (accepted !== true) return NextResponse.json({ error: "accepted must be true" }, { status: 400 });
  if (!hasDatabase()) return NextResponse.json({ error: "no database configured" }, { status: 503 });
  try {
    await recordConsent(owner, request.headers.get("x-vercel-ip-country"));
    return NextResponse.json({ ok: true, version: CONSENT_VERSION });
  } catch (e) {
    console.error("consent:", (e as Error).message);
    return NextResponse.json({ error: "could not save consent" }, { status: 500 });
  }
}
