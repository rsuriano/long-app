# Logos

There is one PNG file for each ticker (`NVDA.png`, `AAPL.png`, …). Each file is square,
with a transparent background. `TokenLogo` finds the file by its ticker. If the file is
missing, `TokenLogo` shows a monogram. The logos show directly on the card, without a disc
behind them. If a logo is not visible in the dark theme, do these steps:

1. Add the file `{TICKER}.dark.png`.
2. Add the ticker to `DARK_VARIANTS` in `apps/web/lib/logos.ts`. (Today, this list
   contains only AMZN.)

Sources:

- AAPL, AMZN, and SPCX: official logos, added manually. SPCX is only the X from the
  wordmark, cropped.
- The other files are placeholders from the public repository `nvstly/icons`
  (ticker_icons).
- SNDK: the S from the 2024 wordmark, cropped from the SVG on Wikimedia Commons (public
  domain).
