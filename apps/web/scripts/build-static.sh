#!/usr/bin/env bash
# Builds the app as plain files, for hosts with no Node process (for example, Caddy).
#
# What you lose without a server: the AI answers only the prompts baked into
# data/baskets.json, everything else falls back to the regex parser, and there is no
# password gate. Good enough to show the product; not the real thing.
#
#   pnpm --filter @long/web build:static   ->  apps/web/out/
set -euo pipefail
cd "$(dirname "$0")/.."

# Three things have to be out of the way, and all three are restored on exit even if the
# build fails:
#
#  - app/api and proxy.ts, because `output: export` cannot carry them and only warns,
#    which would ship a build that silently 404s on its own API.
#  - .next itself. Setting distDir is not enough: the build writes into .next anyway, so
#    a static build leaves the `next start` you have running serving an export with no
#    dynamic routes, no API and no gate. The app goes blank until someone rebuilds.
restore() {
  rm -rf app/api proxy.ts
  [ -d .api-aside ] && mv .api-aside app/api
  [ -f .proxy-aside ] && mv .proxy-aside proxy.ts
  if [ -d .next-server-aside ]; then
    rm -rf .next
    mv .next-server-aside .next
  fi
  rm -rf .next-static
}
trap restore EXIT

mv app/api .api-aside
mv proxy.ts .proxy-aside
[ -d .next ] && mv .next .next-server-aside

LONG_STATIC=1 pnpm exec next build

rm -rf out
# Wherever the export landed: distDir when it is honoured, .next when it is not.
if [ -d .next-static ]; then mv .next-static out; else mv .next out; fi

echo
echo "Listo: $(pwd)/out"
du -sh out
