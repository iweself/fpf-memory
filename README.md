# FPF Spec Runtime

Local `FPF-spec.md` runtime built around the `LocalFPFSpecKnowledgeRuntime` use case.

It uses:

- local deterministic parsing for exact FPF IDs, routes, relations, anchors, and answer envelopes
- a vectorless index compiler that emits structural and graph artifacts directly from `FPF-spec.md`
- Mastra tools plus a stdio MCP server as the integration surface

## Scope

- Runtime source set: `FPF-spec.md` only
- Canonical publishable markdown: `docs/generated/**`
- Static docs build output: `doc_build/` (deterministic, ignored)
- Validation/tuning corpus: outside the runtime path
- No vector database
- No remote indexing service
- No Python code

## Environment

Copy `.env.example` to `.env` and set:

```bash
FPF_SPEC_SOURCE_PATH=FPF-spec.md
FPF_RUNTIME_ARTIFACT_DIR=.runtime/fpf-index
FPF_LOCAL_LLM_BASE_URL=http://localhost:1234/v1
FPF_LOCAL_LLM_MODEL=qwen/qwen3-coder-next
FPF_LOCAL_LLM_API_KEY=
FPF_LOCAL_LLM_TIMEOUT_MS=20000
FPF_MASTRA_LOG_PATH=.runtime/logs/mastra.log
FPF_MASTRA_LOG_LEVEL=info
FPF_MASTRA_OBSERVABILITY_PATH=.runtime/logs/mastra-observability.json
FPF_MASTRA_OBSERVABILITY_FORMAT=flat
FPF_MASTRA_OBSERVABILITY_INCLUDE_INTERNAL_SPANS=true
FPF_MASTRA_OBSERVABILITY_INCLUDE_MODEL_CHUNKS=false
FPF_MASTRA_OBSERVABILITY_LOG_LEVEL=info
FPF_AI_TRACE_LOG_PATH=.runtime/logs/ai-traces.jsonl
```

`FPF_LOCAL_LLM_*` is optional. If present, the runtime uses the local LM Studio `/v1/responses` API only after deterministic retrieval has selected a bounded slice set. If absent, the runtime stays fully deterministic.

`FPF_MASTRA_LOG_PATH` writes Mastra/MCP structured logs as JSON lines.

`FPF_MASTRA_OBSERVABILITY_*` writes Mastra observability snapshots to a JSON file. That file includes Mastra-native spans, logs, metrics, and manual `model_generation` spans around the local LM Studio synthesis call.

`FPF_AI_TRACE_LOG_PATH` writes bounded LM Studio synthesis traces as JSON lines. This is the actual local model call path in this project, because the synthesizer uses a direct `fetch` to the LM Studio-compatible endpoint instead of a Mastra agent model wrapper.

## Commands

```bash
npm run check
npm test
npm run build
npm run docs:generate
npm run docs:build
npm run docs:dev
./scripts/verify-runtime.sh
npm run cli -- status
npm run cli -- refresh
npm run cli -- query --question "What is U.BoundedContext?" --mode verbose
npm run cli -- query --question "How does it connect to role assignment?" --session s1
npm run cli -- inspect --selector "A.1.1"
npm run cli -- read-doc --selector "A.1.1"
npm run cli -- trace --question "How do U.RoleAssignment and U.BoundedContext connect?" --mode proof --session s1
npm run mcp
```

## Mastra surfaces

- `src/mastra/index.ts`: Mastra entrypoint
- `src/mastra/tools/fpf-spec-tools.ts`: refresh/query/status/inspect/trace tools
- `src/mastra/mcp/fpf-spec-server.ts`: stdio MCP server

## Runtime behavior

On each refresh trigger the runtime:

1. hashes `FPF-spec.md`
2. reuses the snapshot if the hash matches
3. otherwise recompiles a local vectorless index
4. writes:
   - `snapshot.json`
   - `build-audit.json`
   - `index-map.json`
   - `pattern-graph.json`
   - `route-graph.json`
   - `lexicon.json`
   - `anchor-map.json`
5. enriches the index map with deterministic section descriptions plus per-node metadata such as role and route-bearing status
6. follows explicit references, route hints, and outline adjacency in a bounded frontier loop when the first anchor set is insufficient
7. optionally reuses a short-lived in-memory session context when `query` or `trace` is called with `--session` or `sessionId`
8. optionally calls a local LM Studio model on bounded slices plus a compact retrieval summary only
9. answers with IDs, citations, constraints, relations, and snapshot metadata

Artifacts are stored under `.runtime/fpf-index/`.

## Docs surfaces

- `FPF-spec.md`: authored source of truth
- `docs/generated/**`: canonical generated markdown collection
- `doc_build/`: deterministic Rspress build output for the wiki-like static viewer

The docs pipeline does not use an LLM step. `npm run docs:generate` writes the canonical markdown collection, and `npm run docs:build` builds the static viewer from that collection.

## Log Files

- `.runtime/logs/mastra.log`: structured Mastra server/tool logs
- `.runtime/logs/mastra-observability.json`: Mastra observability snapshot containing spans, logs, metrics, and manual LM Studio `model_generation` traces
- `.runtime/logs/ai-traces.jsonl`: request/response/error traces for local LM Studio synthesis calls

## Real Verification

Run:

```bash
./scripts/verify-runtime.sh
```

The script verifies:

- the real `cli` path updates `.runtime/logs/mastra.log`
- the real `mcp` stdio startup path writes a startup record to `.runtime/logs/mastra.log`
- the LM Studio path updates `.runtime/logs/mastra-observability.json` and `.runtime/logs/ai-traces.jsonl` when `FPF_LOCAL_LLM_BASE_URL` and `FPF_LOCAL_LLM_MODEL` are set
