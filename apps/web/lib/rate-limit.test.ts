import { beforeEach, describe, expect, it } from "vitest";
import { GLOBAL, PER_IP, checkRateLimit, clientIp, resetRateLimit } from "./rate-limit";

beforeEach(resetRateLimit);

describe("checkRateLimit", () => {
  it("allows a caller up to the per-IP limit, then refuses", () => {
    for (let i = 0; i < PER_IP.limit; i++) expect(checkRateLimit("1.1.1.1").ok, `call ${i}`).toBe(true);
    const over = checkRateLimit("1.1.1.1");
    expect(over.ok).toBe(false);
    if (!over.ok) {
      expect(over.scope).toBe("ip");
      expect(over.retryAfterSec).toBeGreaterThan(0);
    }
  });

  it("does not punish one caller for another's traffic", () => {
    for (let i = 0; i < PER_IP.limit + 5; i++) checkRateLimit("1.1.1.1");
    expect(checkRateLimit("2.2.2.2").ok).toBe(true);
  });

  it("lets a caller back in once the window rolls over", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < PER_IP.limit; i++) checkRateLimit("1.1.1.1", t0);
    expect(checkRateLimit("1.1.1.1", t0).ok).toBe(false);
    expect(checkRateLimit("1.1.1.1", t0 + PER_IP.windowMs + 1).ok).toBe(true);
  });

  it("caps total spend across every caller", () => {
    let allowed = 0;
    for (let i = 0; i < GLOBAL.limit + 50; i++) if (checkRateLimit(`ip-${i}`).ok) allowed++;
    expect(allowed).toBe(GLOBAL.limit);
    const over = checkRateLimit("someone-new");
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.scope).toBe("global");
  });
});

describe("clientIp", () => {
  it("takes the first hop of x-forwarded-for", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }))).toBe("9.9.9.9");
  });
  it("falls back to x-real-ip, then to a constant", () => {
    expect(clientIp(new Headers({ "x-real-ip": "8.8.8.8" }))).toBe("8.8.8.8");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
