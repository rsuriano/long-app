# Voice and wording (so that the text does not sound like AI)

This is the style guide for all text that a person reads: the app, the landing page, a
form, a pitch, a public README. It applies to all our projects. The examples come from
Long, the first project that used this guide. But the rules are general.

Language rules:

- Product: English, unless the product is for Spanish speakers.
- Docs: English, written to ASD-STE100 (Simplified Technical English).
- Commits: Rioplatense Spanish.

## The main rule

**The fact does the work, not the adjective.** If something is fast, tell how long it
takes. If it is cheap, tell the fee. If it works, show the hash. A text that needs
"seamless", "powerful", or "revolutionary" is a text without the fact.

- ✗ "Fast, secure and cheap onchain execution."
- ✓ "A three-stock buy cost $0.016 of gas. One signature."

## What "claudish" text looks like (do not use)

- Stacked adjectives and brochure words: seamless, effortless, powerful, robust,
  cutting-edge, revolutionary, empower, unlock, elevate, supercharge, leverage, journey,
  ecosystem, landscape, game-changer, "in today's fast-paced world".
- The construction "It's not X, it's Y." and groups of three ("simple, fast and secure").
- Rhetorical questions as titles ("Tired of generic ETFs?").
- "Whether you're a beginner or a pro…", "Let's dive in", "Here's the thing:", "The best
  part?".
- Too many long dashes, enthusiastic exclamations, emoji as bullets.
- Kickers or eyebrows in capital letters above a title ("HOW IT WORKS"). The title is
  sufficient alone.
- A summary or a CTA at the end of each paragraph. Say it one time.
- Abstract jargon that says nothing: "granularity", "value proposition", "next-gen",
  "AI-powered" as an adjective, "onchain primitives" (except for a technical audience,
  refer to the section below).
- Hedging: "might", "could potentially", "aims to". The product does it or does not do it.

## How our product sounds

- **A verb that the user says.** The buttons name the action, not the function. "Go
  long", "Looks good", "Back to portfolio", "Open the app". Never "Submit", "Proceed",
  "Execute transaction".
- **The confirmation tells what occurred.** "You're long." · "AI Data Center is in your
  wallet." Not "Success!" and not "Your transaction has been processed successfully".
- **An error names the problem and the solution.** "Not enough USDC. Pay with ARGt or
  lower the amount." Not "Something went wrong" and not "Insufficient funds".
- **Examples that a real person writes.** "the picks and shovels of AI", "Mom's
  favorites", "AI without Nvidia". Not "Technology sector exposure".
- **Common nouns.** stocks, wallet, fee, basket, index. Not assets, custody solution,
  positions (except for a technical audience).
- **One idea in each sentence, short sentences.** If there is a semicolon, it is
  possibly two sentences.
- **Humor: yes. Humor at the cost of a named person: no.** "the apps you can't stop
  opening" is good. "AI without Zuckerberg" on the cover page is not good. (It stays in
  the app as a user idea.)
- **The flex is nonchalant.** Tell the fact and do not comment on it. "Built in a few
  days." Not "In an incredible feat, built in just a few days!".
- **US number format** in the product: $2,490.52, 0.5%.

## Honesty (this is also voice)

A claim that cannot answer a question is claudish text, also when it sounds good.

- ✗ "one of Argentina's largest exchanges" → ✓ "an Argentinian fintech app" (you cannot
  rank it).
- ✗ "machine learning since before LLMs" (this was not true) → ✓ "in Long the AI does one
  job and everything else is deterministic" (you can verify it in the code).
- ✗ "Launched" with one user → ✓ "Beta" / "It's very early: the app went live
  yesterday".
- ✗ My test transactions as "traction" → ✓ traction: none yet, and say it.
- ✗ A lawyer disclaimer → ✓ "Long is a product interface, not a broker."

## Two audiences, one voice

- **User in the app or on the landing page:** no crypto jargon. "your wallet", "one tap",
  "the shares are yours". Never "EIP-5792", "paymaster", "atomic batch".
- **Technical readers (docs, technical forms):** use the exact names here, because they are the
  proof: "EIP-5792 batch", "Coinbase Smart Wallet", "Chainlink feeds", "Aerodrome". The
  same honesty, with more precision.

## Before / after (real cases from Long)

| Before | After |
|---|---|
| "Say it like you'd say it to a friend." (ok) + kicker "TRY ONE" | No kicker. The chips are sufficient alone |
| "Sized by conviction" | "Sized by market cap, max 35% each" (what it really does) |
| "Demo · Connect wallet" in a marketing screenshot | The same screen with "$320.00 USDC" |
| "could never find the granularity I seek" | "no existing index ever let me buy exactly the thesis I had in mind" |
| "taking advantage of Base's wallet and tokenized stocks" | "Long builds a personalized index of tokenized stocks on Base and buys it in one tap" |
| "ready to get even more improvements and local funding options" | "with local stablecoin onramps as the next step" |
| "Everything that matters is onchain" | "Assets, accounts and execution are all onchain, and all on Base" |

## Before you publish a text

1. Is there an adjective that a number or a fact can replace? Replace it.
2. Can you say it aloud to a developer friend without embarrassment? If not, write it
   again.
3. Can it answer the question "Is that true?" from a technical reader? If not, remove it.
4. Can it be on the page of a different startup? Then it says nothing about your product.
