import type { Basket, Token } from "@long/universe";
import { getTokens } from "@long/universe";
import { clientFromEnv, type ChatClient, type ChatMessage } from "./client.ts";
import { fallbackBasket } from "./fallback.ts";
import { parseBasket } from "./parse.ts";
import { repairPrompt, systemPrompt, userPrompt } from "./prompt.ts";

export * from "./client.ts";
export { extractJson, parseBasket } from "./parse.ts";
export { fallbackBasket } from "./fallback.ts";
export { renderUniverse, systemPrompt } from "./prompt.ts";

/** Where the basket came from, so the UI and the logs can tell them apart. */
export type BasketSource = "model" | "repair" | "fallback";

export type BasketResult = {
  basket: Basket;
  source: BasketSource;
  model: string;
  /** Completions requested. 1 on a clean answer, 2 when a repair was needed. */
  attempts: number;
  /** Why the first answer was rejected, or why we fell back. Empty on a clean answer. */
  problems: string[];
  ms: number;
};

export type PromptToBasketOptions = {
  /** Injected in tests; defaults to the client built from the environment. */
  client?: ChatClient;
  tokens?: Token[];
};

/**
 * Turns a plain-language prompt into a validated basket.
 *
 * The model proposes; a deterministic validator decides. On a rule break we hand the
 * errors back once and let it correct itself; if that also fails, or the provider is
 * unreachable, we return a template basket. This function does not throw: the build
 * screen always has something to show.
 */
export async function promptToBasket(
  prompt: string,
  options: PromptToBasketOptions = {},
): Promise<BasketResult> {
  const started = Date.now();
  const tokens = options.tokens ?? getTokens();
  const client = options.client ?? clientFromEnv();
  const done = (basket: Basket, source: BasketSource, attempts: number, problems: string[]): BasketResult => ({
    basket,
    source,
    model: client?.model ?? "none",
    attempts,
    problems,
    ms: Date.now() - started,
  });

  if (!client) {
    return done(fallbackBasket(prompt, tokens), "fallback", 0, ["no model client configured (set OPENROUTER_API_KEY)"]);
  }

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt(tokens) },
    { role: "user", content: userPrompt(prompt) },
  ];

  let firstProblems: string[] = [];
  for (let attempt = 1; attempt <= 2; attempt++) {
    let text: string;
    try {
      text = await client.complete(messages);
    } catch (e) {
      return done(fallbackBasket(prompt, tokens), "fallback", attempt, [...firstProblems, (e as Error).message]);
    }

    const parsed = parseBasket(text);
    if (parsed.ok) {
      return done(parsed.basket, attempt === 1 ? "model" : "repair", attempt, firstProblems);
    }

    if (attempt === 1) {
      firstProblems = parsed.errors;
      messages.push({ role: "assistant", content: text }, { role: "user", content: repairPrompt(parsed.errors) });
    } else {
      return done(fallbackBasket(prompt, tokens), "fallback", attempt, [...firstProblems, ...parsed.errors]);
    }
  }

  /* c8 ignore next */
  return done(fallbackBasket(prompt, tokens), "fallback", 2, firstProblems);
}
