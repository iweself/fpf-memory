#!/bin/bash
# Stage the two files the deployed runtime actually reads:
#   1. runtime source file (staged under .fpf-upstream/FPF-Spec.md in public) — source hash for freshness check
#   2. snapshot.json       — compiled index (the only artifact loadSnapshot() reads)
#
# The other 6 artifact files (index-map, pattern-graph, …) are
# write-only debugging output — never loaded back by the runtime.
#
# Usage:  bash scripts/prepare-deploy.sh
#         bun run deploy

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Refreshing index snapshot and staging hosted assets..."
bun "$ROOT/scripts/prepare-deploy.ts"
