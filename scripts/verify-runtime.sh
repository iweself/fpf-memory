#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

QUERY_TEXT="${FPF_VERIFY_QUERY:-What is U.BoundedContext?}"
CLI_MODE="${FPF_VERIFY_MODE:-verbose}"
MAS_LOG="${FPF_MASTRA_LOG_PATH:-.runtime/logs/mastra.log}"
OBS_LOG="${FPF_MASTRA_OBSERVABILITY_PATH:-.runtime/logs/mastra-observability.json}"
AI_LOG="${FPF_AI_TRACE_LOG_PATH:-.runtime/logs/ai-traces.jsonl}"

[[ "$MAS_LOG" = /* ]] || MAS_LOG="$ROOT_DIR/$MAS_LOG"
[[ "$OBS_LOG" = /* ]] || OBS_LOG="$ROOT_DIR/$OBS_LOG"
[[ "$AI_LOG" = /* ]] || AI_LOG="$ROOT_DIR/$AI_LOG"

mkdir -p "$(dirname "$MAS_LOG")"

printf '==> Running type-check\n'
bun run check

mas_before_size="$([[ -f "$MAS_LOG" ]] && wc -c <"$MAS_LOG" | tr -d ' ' || printf '0')"

printf '==> Running CLI status\n'
bun run cli -- status >/dev/null

mas_after_size="$(wc -c <"$MAS_LOG" | tr -d ' ')"
(( mas_after_size > mas_before_size ))
grep -q '"msg":"CLI command start"' "$MAS_LOG"
grep -q '"msg":"CLI command finished"' "$MAS_LOG"

printf '==> Starting MCP stdio server briefly\n'
bun run mcp >/dev/null 2>&1 &
mcp_pid="$!"
trap 'kill "$mcp_pid" 2>/dev/null || true; wait "$mcp_pid" 2>/dev/null || true' EXIT
sleep 2
kill "$mcp_pid" 2>/dev/null || true
wait "$mcp_pid" 2>/dev/null || true
trap - EXIT

grep -q '"msg":"MCP stdio server start"' "$MAS_LOG"

printf '==> CLI and MCP logging verified\n'
printf '    runtime log: %s\n' "$MAS_LOG"

if [[ -n "${FPF_LOCAL_LLM_BASE_URL:-}" && -n "${FPF_LOCAL_LLM_MODEL:-}" ]]; then
  printf '==> Running LM Studio-backed query\n'
  obs_before_size="$([[ -f "$OBS_LOG" ]] && wc -c <"$OBS_LOG" | tr -d ' ' || printf '0')"
  ai_before_size="$([[ -f "$AI_LOG" ]] && wc -c <"$AI_LOG" | tr -d ' ' || printf '0')"

  bun run cli -- query --question "$QUERY_TEXT" --mode "$CLI_MODE" >/dev/null

  obs_after_size="$(wc -c <"$OBS_LOG" | tr -d ' ')"
  ai_after_size="$(wc -c <"$AI_LOG" | tr -d ' ')"

  (( obs_after_size > obs_before_size ))
  (( ai_after_size > ai_before_size ))
  grep -q '"type": "model_generation"' "$OBS_LOG"
  grep -q '"provider": "lm_studio"' "$OBS_LOG"
  grep -q '"phase":"request"' "$AI_LOG"
  grep -Fq "\"question\":\"$QUERY_TEXT\"" "$AI_LOG"

  printf '==> LM Studio synthesis logging verified\n'
  printf '    observability log: %s\n' "$OBS_LOG"
  printf '    ai trace log: %s\n' "$AI_LOG"
else
  printf '==> Skipping LM Studio verification because FPF_LOCAL_LLM_BASE_URL and FPF_LOCAL_LLM_MODEL are not both set\n'
fi

printf '==> Verification complete\n'
