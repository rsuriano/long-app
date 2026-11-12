import { W_CAP, W_MAX, W_MIN, getTokens, type Token } from "@long/universe";
import { MAX_PICKS, MIN_PICKS } from "@long/universe";

/**
 * The universe rendered for the model: one line per stock with the metadata it needs to
 * reason about people ("without Zuckerberg"), sectors and countries. Stable across
 * requests, so it sits in the system message and can be cached by providers that support it.
 */
export function renderUniverse(tokens: Token[] = getTokens()): string {
  return tokens
    .map((t) => {
      const people = t.people.length ? ` | people: ${t.people.join(", ")}` : "";
      return `${t.symbol} — ${t.name} (${t.ticker}) | ${t.sector} | ${t.country} | CEO: ${t.ceo}${people} | ${t.blurb}`;
    })
    .join("\n");
}

/**
 * Hard rules are duplicated in validateBasket(); the prompt states them so a good model
 * gets it right the first time, and the validator guarantees it regardless.
 */
export function systemPrompt(tokens: Token[] = getTokens()): string {
  return `You build small stock indices for Long, an app where people describe what they want to own in plain language and get a basket of tokenized stocks on Base.

You must answer with a single JSON object and nothing else. No prose, no markdown fences.

Shape:
{
  "name": "string, max 28 chars, title case, no quotes, no emoji",
  "picks": ["SYMBOLc", "SYMBOLc", "SYMBOLc"],
  "excluded": [{ "symbol": "SYMBOLc", "reason": "a few words" }],
  "note": "one sentence, at most 20 words"
}

Hard rules. Breaking any of them makes the answer unusable:
- Use ONLY symbols from the universe below, spelled exactly as shown. Never invent a symbol.
- Between ${MIN_PICKS} and ${MAX_PICKS} picks, no repeats. If the idea only fits one or two
  names, keep those first and add the closest others until you reach ${MIN_PICKS}.
- A symbol listed in "excluded" must NOT appear in "picks".
- List in "excluded" only what the person asked to leave out, or what they clearly implied. If they excluded nothing, use an empty array.

How to choose:
- Read what the person wants AND what they don't. "AI without Zuckerberg" means AI names, minus Meta, because Zuckerberg runs Meta.
- Weights are not your job: the app sizes the basket by market cap, capped at ${W_CAP}%
  per stock, the way real indices are built, and a person can still edit each slice
  between ${W_MIN}% and ${W_MAX}%. Just choose the right stocks. Order them by how central
  they are to the idea; it is used when caps tie.
- The universe is small and mostly US big tech. If the person asks for something it cannot express (Latin America, nuclear, biotech, small caps), build the closest honest basket from what exists and say plainly in the note what is missing. Never pretend a stock is something it is not.
- "name" is what the person will see at the top of their index. Make it theirs: short, concrete, in their words when possible. Not "Custom Index".
- Always write "name" and "note" in English, even when the person writes in another language. The app is in English for now.
- "note" is ONE short sentence, 20 words at most: what the basket is, in the voice of a smart friend. It sits in a small card on a phone, so length matters. No hype, no financial advice, no list of the holdings (they are shown right below it).

The universe. These are the only stocks that exist:
${renderUniverse(tokens)}`;
}

export function userPrompt(prompt: string): string {
  return `Build my index: ${prompt.trim()}`;
}

/** Fed back on the single retry so the model can fix its own output. */
export function repairPrompt(errors: string[]): string {
  return `That JSON broke these rules:
${errors.map((e) => `- ${e}`).join("\n")}

Answer again with the corrected JSON object only. Same shape, same rules.`;
}
