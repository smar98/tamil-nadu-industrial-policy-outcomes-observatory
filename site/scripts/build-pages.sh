#!/usr/bin/env bash
# Assemble the static GitHub Pages bundle from the vinext build.
#
# The site is fully client-rendered from one JSON file, so the worker build's
# client assets plus one captured HTML shell are a complete static site. Three
# rewrites make it work under the /​<repo>/ sub-path GitHub Pages serves from:
#   1. absolute /assets/ URLs in the HTML shell -> ./assets/
#   2. the capture-time localhost og:image URL -> the live URL
#   3. the Vite preload helper's window.location.origin base -> document.baseURI
#
# Usage: bash scripts/build-pages.sh <output-dir>
# Run from site/ after `npm run build`. Serves the shell via `vinext start`.
set -euo pipefail

OUT="${1:?usage: build-pages.sh <output-dir>}"
LIVE_URL="https://smar98.github.io/tamil-nadu-industrial-policy-outcomes-observatory"
PORT=4173

npm run start -- --port "$PORT" >/tmp/vinext-pages-start.log 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null || true' EXIT
until curl -sf "http://localhost:$PORT/" -o /tmp/vinext-pages-shell.html; do sleep 1; done

rm -rf "$OUT"
mkdir -p "$OUT"
cp -R dist/client/. "$OUT/"
rm -f "$OUT/_headers"
touch "$OUT/.nojekyll"

python3 - "$OUT" "$LIVE_URL" "$PORT" <<'PY'
import glob, sys
out, live, port = sys.argv[1], sys.argv[2], sys.argv[3]

html = open("/tmp/vinext-pages-shell.html").read()
html = html.replace('"/assets/', '"./assets/')
html = html.replace(f"http://localhost:{port}/og.png", f"{live}/og.png")
html = html.replace("<head>", '<head><link rel="icon" href="./favicon.svg"/>', 1)
assert "localhost" not in html and '"/assets/' not in html
open(f"{out}/index.html", "w").write(html)

replacements = [
    ("new URL(e,window.location.origin)", "new URL(e,document.baseURI)"),
    ("function(e){return`/`+e}", "function(e){return`./`+e}"),
]
patched = 0
for path in glob.glob(f"{out}/assets/*.js"):
    src = open(path).read()
    updated = src
    for old, new in replacements:
        updated = updated.replace(old, new)
    if updated != src:
        open(path, "w").write(updated)
        patched += 1
assert patched >= 1, "preload-base patch sites not found; check the Vite helper"
print(f"pages bundle written to {out} (patched {patched} chunk)")
PY
