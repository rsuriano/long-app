import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, GATE_PATH, accessToken, tokensMatch } from "@/lib/gate";

/**
 * Keeps the private preview private. Renamed from middleware in Next 16; same job.
 *
 * Open in development so local work has no friction. In production the gate is on while
 * LONG_ACCESS_PASSWORD is set; unset, the app is public (see below).
 */
/**
 * Tokenized stocks are not offered to US persons (Coinbase's terms, and ours). The
 * country comes from Vercel's edge header, which a browser cannot forge; where the
 * header is absent (local, other hosts) nothing is blocked. LONG_BLOCKED_COUNTRIES
 * overrides the list, e.g. for a test.
 */
const BLOCKED = (process.env.LONG_BLOCKED_COUNTRIES ?? "US").split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);
const UNAVAILABLE_PATH = "/unavailable";

export async function proxy(request: NextRequest) {
  const country = request.headers.get("x-vercel-ip-country")?.toUpperCase();
  const { pathname } = request.nextUrl;
  if (country && BLOCKED.includes(country) && pathname !== UNAVAILABLE_PATH) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "not available in your country" }, { status: 451 });
    }
    const url = request.nextUrl.clone();
    url.pathname = UNAVAILABLE_PATH;
    url.search = "";
    return NextResponse.rewrite(url, { status: 451 });
  }

  if (process.env.NODE_ENV === "development") return NextResponse.next();

  // No password configured means the app is public. The gate was for the private
  // preview; with the geoblock, the declaration and the model rate limits in place,
  // removing LONG_ACCESS_PASSWORD from the environment is how it opens.
  const password = process.env.LONG_ACCESS_PASSWORD;
  if (!password) return NextResponse.next();
  const cookie = request.cookies.get(GATE_COOKIE)?.value;
  if (cookie && tokensMatch(cookie, await accessToken(password))) {
    return NextResponse.next();
  }

  // An API call gets an honest status instead of a login page it cannot render.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "private preview" }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = GATE_PATH;
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except the gate itself, its endpoint, and the assets the gate needs.
  matcher: ["/((?!gate|api/gate|unavailable|_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/|img/|logos/).*)"],
};
