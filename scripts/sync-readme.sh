#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
README="$ROOT/README.md"
SDK_DIST="$ROOT/packages/sdk/dist"

# Build SDK if dist doesn't exist
if [ ! -f "$SDK_DIST/index.iife.js" ]; then
  echo "Building SDK..."
  pnpm --filter flaregun build
fi

# Calculate sizes
IIFE_GZIP=$(gzip -c "$SDK_DIST/index.iife.js" | wc -c | tr -d ' ')
SNIPPET_RAW=$(wc -c < "$SDK_DIST/snippet.min.js" | tr -d ' ')
SNIPPET_CONTENT=$(cat "$SDK_DIST/snippet.min.js")

# Strip the tsup IIFE wrapper: remove leading "use strict";(()=>{  and trailing  })();
SNIPPET_CLEAN=$(echo "$SNIPPET_CONTENT" | sed 's/^"use strict";//' | sed 's/^(()=>{//' | sed 's/})();$//')

# Inject sizes
sed -i '' "s/<!-- IIFE_GZIP -->.*<!-- \/IIFE_GZIP -->/<!-- IIFE_GZIP -->${IIFE_GZIP}B<!-- \/IIFE_GZIP -->/" "$README"
sed -i '' "s/<!-- SNIPPET_RAW -->.*<!-- \/SNIPPET_RAW -->/<!-- SNIPPET_RAW -->${SNIPPET_RAW}B<!-- \/SNIPPET_RAW -->/" "$README"

# Inject snippet between markers
python3 -c "
import re, sys
readme = open('$README').read()
snippet = '''$SNIPPET_CLEAN'''
pattern = r'(<!-- SNIPPET_START -->\n).*?(\n<!-- SNIPPET_END -->)'
replacement = r'\1' + snippet + r'\2'
result = re.sub(pattern, replacement, readme, flags=re.DOTALL)
open('$README', 'w').write(result)
"

echo "README synced: IIFE=${IIFE_GZIP}B gzip, snippet=${SNIPPET_RAW}B raw"
