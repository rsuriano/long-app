/**
 * Password gate for the private preview. Not a user system: one shared password, no
 * accounts. It exists so the link can be shared with a few people without the app being
 * open to anyone who guesses the subdomain — and so nobody else spends our model credit.
 *
 * The password lives in LONG_ACCESS_PASSWORD, never in the repo. The cookie holds a hash
 * of it, so a stolen cookie grants access (that is the point) but does not reveal the
 * password, which is likely reused elsewhere.
 */
export const GATE_COOKIE = "long_access";
export const GATE_PATH = "/gate";
/** Long enough that the demo is not interrupted, short enough that access expires. */
export const GATE_MAX_AGE = 30 * 24 * 60 * 60;

export async function accessToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`long-gate:v1:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Length-independent compare, so timing does not leak how much of the token matched. */
export function tokensMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
