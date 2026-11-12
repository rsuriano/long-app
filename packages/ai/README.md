# @long/ai

`promptToBasket(prompt)` changes natural language into a validated basket of the 10
tokenized stocks on Base.

```
prompt ──▶ model ──▶ validator ──▶ pass? ──▶ basket
                         │
                         └─ no ─▶ send the errors to the model ──▶ one retry
                                                                     │
                                                                     └─ fail ─▶ template
```

The model proposes. A deterministic validator decides. The function never throws an
exception. If the model fails two times, or if the provider does not respond, the function
returns a valid template basket. Thus, the build screen always has a basket to show. The
`source` field tells you where the basket came from (`model`, `repair`, `fallback`).

## Run

```
pnpm --filter @long/ai try                      # the mock prompts against the model
pnpm --filter @long/ai try "AI without Musk"    # your own prompt
pnpm --filter @long/ai bench                    # compare models: accuracy, latency
pnpm --filter @long/ai test                     # tests, no calls to the API
```

The package reads `OPENROUTER_API_KEY` from the `.env` file in the root. If there is no
key, `promptToBasket` returns the template basket. The tests also pass without a key,
because the tests inject the client.

| Variable | Default | Purpose |
|---|---|---|
| `OPENROUTER_API_KEY` | — | Without this key, there is no model |
| `LONG_AI_MODEL` | `google/gemini-2.5-flash-lite` | Any OpenRouter ID |
| `LONG_AI_REASONING` | `low` | `low`/`medium`/`high`/`off` |

## Model selection (measured on 8 September 2026, 8 real prompts)

Default: **google/gemini-2.5-flash-lite**. It takes approximately 4.5 s and costs
approximately 0.02¢ for each basket. In the tests, it never used the template basket.

| Model | Clean | Failed | Median | Cost for each basket |
|---|---|---|---|---|
| **google/gemini-2.5-flash-lite** | 7/8* | 0 | 4.5 s | ~0.02¢ |
| anthropic/claude-opus-4.8 | 6/8 | 0 | 3.5 s | ~1.2¢ |
| anthropic/claude-haiku-4.5 | 8/8 | 0 | 14 s | ~0.3¢ |
| deepseek/deepseek-v4-flash | 7/8 | 1 | 15 s | ~0.02¢ |
| z-ai/glm-4.7-flash | 0/8 | 8 | — | — |

\*The one result from Gemini that was not clean was our error. "Everything Elon" gives two
correct stocks (Tesla and SpaceX). The minimum of 3 stocks returned an unclear error. We
corrected this.

The Chinese models understand the problem. But they reason before they answer, and they
take 15 to 45 s. Opus is the fastest model and makes the best baskets. But its price is 60
times the price of Gemini. Gemini is the correct balance for this task: it is fast and
cheap, and the task does not need the best model. For the demo, you can change to Opus
with one environment variable (`LONG_AI_MODEL`).

`routeBy: "throughput"` tells OpenRouter to use the fastest provider, not the cheapest
provider. This is important for models with many providers, for example the Chinese
models. It is not important for Anthropic or Google, because they have only one provider.
