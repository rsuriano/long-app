import { NextResponse } from "next/server";
import { GATE_COOKIE, GATE_MAX_AGE, accessToken } from "@/lib/gate";

export const runtime = "nodejs";

/** Trades the shared password for the access cookie. */
export async function POST(request: Request) {
  const expected = process.env.LONG_ACCESS_PASSWORD;
  if (!expected) {
    return NextResponse.json({ error: "access is not configured on this deployment" }, { status: 503 });
  }

  let password: unknown;
  try {
    ({ password } = (await request.json()) as { password?: unknown });
  } catch {
    return NextResponse.json({ error: "expected a JSON body" }, { status: 400 });
  }

  if (typeof password !== "string" || password !== expected) {
    // Deliberately vague, and slow enough to make guessing tedious.
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: "that's not it" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(GATE_COOKIE, await accessToken(expected), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: GATE_MAX_AGE,
  });
  return res;
}
