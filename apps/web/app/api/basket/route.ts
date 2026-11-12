import { NextResponse } from "next/server";
import { promptToBasket } from "@long/ai";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { countModelCall } from "@/lib/server/usage";
import { lookup, remember } from "@/lib/basket-cache";

/**
 * Prompt to basket. Runs on the server so the model key never reaches the browser.
 *
 * Answers 200 with a basket whenever it can: promptToBasket falls back to a template
 * rather than throwing, so the build screen never dead-ends. `source` says where it came
 * from. The exception is a rate limit, which is a real 429 the client should respect.
 *
 * A cached answer skips both the model and the rate limit: it costs nothing, so there is
 * nothing to protect against.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_PROMPT = 200;

export async function POST(request: Request) {
  let prompt: unknown;
  try {
    ({ prompt } = (await request.json()) as { prompt?: unknown });
  } catch {
    return NextResponse.json({ error: "expected a JSON body" }, { status: 400 });
  }

  if (typeof prompt !== "string" || !prompt.trim()) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }
  const text = prompt.slice(0, MAX_PROMPT);

  const cached = lookup(text);
  if (cached) {
    return NextResponse.json({
      basket: cached.basket,
      source: "cache",
      model: cached.layer,
      attempts: 0,
      problems: [],
      ms: 0,
    });
  }

  const limit = checkRateLimit(clientIp(request.headers));
  if (!limit.ok) {
    return NextResponse.json(
      {
        error: limit.scope === "global" ? "too many baskets right now, try again shortly" : "slow down a little",
        retryAfterSec: limit.retryAfterSec,
      },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSec) } },
    );
  }

  // The shared ceiling, counted in the database across every instance.
  const usage = await countModelCall().catch((e) => { console.error("usage:", (e as Error).message); return { ok: true as const }; });
  if (!usage.ok) {
    return NextResponse.json(
      { error: "Long has built a lot of baskets today; try again later", retryAfterSec: usage.retryAfterSec },
      { status: 429, headers: { "retry-after": String(usage.retryAfterSec) } },
    );
  }

  const result = await promptToBasket(text);
  // A template answer is not worth remembering: the next call may well succeed.
  if (result.source !== "fallback") remember(text, result.basket);
  // Useful while we are still choosing a model; drop before launch if it gets noisy.
  console.log(`[basket] ${result.source} ${result.ms}ms ${result.model} "${text.slice(0, 60)}"`);
  return NextResponse.json(result);
}
