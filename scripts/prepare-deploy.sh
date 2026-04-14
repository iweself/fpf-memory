#!/bin/bash
# Stage the two files the deployed runtime actually reads:
#   1. FPF-spec.md        — source hash for freshness check
#   2. snapshot.json       — compiled index (the only artifact loadSnapshot() reads)
#
# The other 6 artifact files (index-map, pattern-graph, …) are
# write-only debugging output — never loaded back by the runtime.
#
# Usage:  bash scripts/prepare-deploy.sh
#         bun run deploy

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PUBLIC="$ROOT/src/mastra/public"
INDEX="$ROOT/.runtime/fpf-index"

# 1. Rebuild snapshot so staged artifact matches current source
echo "Refreshing index snapshot..."
bun "$ROOT/src/cli.ts" refresh

# 2. Stage only what the runtime reads
mkdir -p "$PUBLIC/.runtime/fpf-index"
cp "$ROOT/FPF-spec.md" "$PUBLIC/FPF-spec.md"
cp "$INDEX/snapshot.json" "$PUBLIC/.runtime/fpf-index/snapshot.json"

echo "Staged into src/mastra/public/:"
du -sh "$PUBLIC/FPF-spec.md" "$PUBLIC/.runtime/fpf-index/snapshot.json"
