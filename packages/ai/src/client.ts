/**
 * The model behind promptToBasket, as a one-method interface.
 *
 * Everything above this line is provider-agnostic and testable without a key: the tests
 * inject a fake. Today the concrete client talks to OpenRouter (OpenAI-compatible), which
 * serves cheap Chinese models for development. The plan calls for Claude on the demo path
 * (docs/long-plan.md, "Capa de IA"); swapping is a new adapter, not a rewrite.
 */
export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ChatClient = {
  /** Returns the model's raw text. Throws on transport or provider errors. */
  complete(messages: ChatMessage[]): Promise<string>;
  /** For logging and receipts. */
  readonly model: string;
};

export type OpenRouterOptions = {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  /**
   * A basket is ~250 tokens, but reasoning models (DeepSeek V4, Qwen thinking) burn
   * budget before emitting any content, and a truncated turn returns an empty string.
   * Leave room for both.
   */
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  /** Sent to OpenRouter for its dashboard; harmless elsewhere. */
  appUrl?: string;
  appName?: string;
  /**
   * How hard the model may think before answering. The cheap models are all reasoning
   * models and will happily spend 50s on a basket; "low" cuts that several-fold with no
   * measured loss on these prompts. Providers that don't support it ignore it.
   */
  reasoningEffort?: "low" | "medium" | "high" | "off";
  /**
   * OpenRouter is a marketplace: by default it sends the request to whichever provider is
   * cheapest, and speed is not part of that deal — the same model and prompt measured 8s
   * and 33s on different runs. "throughput" asks for the fastest one instead.
   */
  routeBy?: "price" | "throughput" | "latency";
};

/**
 * Fast, cheap and reliable at this task: ~4.5s per basket, ~0.02 cents, and it never fell
 * to the template across the eight test prompts. The cheap Chinese models cost the same
 * but take 15-45s (they reason before answering); Opus is 3.5s but 60x the price. Override
 * with LONG_AI_MODEL. See README for the numbers.
 */
export const DEFAULT_MODEL = "google/gemini-2.5-flash-lite";

/**
 * OpenAI-compatible chat completions client (OpenRouter, and anything speaking the same
 * shape). Asks for a JSON object response; the parser tolerates providers that ignore it.
 */
export function openRouterClient(opts: OpenRouterOptions): ChatClient {
  const {
    apiKey,
    model = DEFAULT_MODEL,
    baseUrl = "https://openrouter.ai/api/v1",
    maxTokens = 4000,
    temperature = 0.2,
    timeoutMs = 60_000,
    appUrl = "https://long.bedrocklabs.dev",
    appName = "Long",
    reasoningEffort = "low",
    routeBy = "throughput",
  } = opts;

  if (!apiKey) throw new Error("openRouterClient: missing API key");

  return {
    model,
    async complete(messages) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${apiKey}`,
            "HTTP-Referer": appUrl,
            "X-Title": appName,
          },
          body: JSON.stringify({
            model,
            messages,
            max_tokens: maxTokens,
            temperature,
            response_format: { type: "json_object" },
            ...(reasoningEffort === "off"
              ? { reasoning: { enabled: false } }
              : { reasoning: { effort: reasoningEffort } }),
            ...(routeBy === "price" ? {} : { provider: { sort: routeBy } }),
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          // Never include the request headers here: they carry the key.
          const body = await res.text().catch(() => "");
          throw new Error(`OpenRouter ${res.status} ${res.statusText}: ${body.slice(0, 300)}`);
        }

        const json = (await res.json()) as {
          choices?: { message?: { content?: string; refusal?: string }; finish_reason?: string }[];
          error?: { message?: string };
        };
        if (json.error) throw new Error(`OpenRouter: ${json.error.message ?? "unknown error"}`);

        const choice = json.choices?.[0];
        const text = choice?.message?.content;
        if (!text) {
          if (choice?.finish_reason === "length") {
            throw new Error(
              `OpenRouter: ${model} hit the ${maxTokens}-token cap before answering (reasoning models spend it thinking); raise maxTokens`,
            );
          }
          if (choice?.message?.refusal) throw new Error(`OpenRouter: ${model} refused: ${choice.message.refusal}`);
          throw new Error(`OpenRouter: ${model} returned no content (finish_reason: ${choice?.finish_reason ?? "unknown"})`);
        }
        return text;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

/** Builds the client from the environment. Returns null when no key is configured. */
export function clientFromEnv(env: NodeJS.ProcessEnv = process.env): ChatClient | null {
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) return null;
  const effort = env.LONG_AI_REASONING as OpenRouterOptions["reasoningEffort"] | undefined;
  return openRouterClient({
    apiKey,
    model: env.LONG_AI_MODEL || DEFAULT_MODEL,
    ...(effort ? { reasoningEffort: effort } : {}),
  });
}
