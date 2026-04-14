---
title: "MCP Interface"
description: "Spec-oriented interface contract for the hosted and local FPF MCP surfaces."
---

# MCP Interface

This page documents the MCP surfaces implemented by `fpf_memory`.

Decision record:

- [DRR-0001: MCP As The First-Class Codex Interface](/drr/DRR-0001-mcp-first-class-interface/)

The runtime itself is compiler-backed and local to `FPF-spec.md`:

- authored source: `FPF-spec.md`
- runtime artifacts: `.runtime/fpf-index/*`
- canonical publishable markdown: `docs/generated/**`
- static docs build: ignored `doc_build/`

## Transport

- hosted/public (default Codex path): `https://fpf-memory-remote-20260414.server.mastra.cloud/api/mcp/fpf_memory/mcp`
- stdio (local expert/dev path): `FPF_MCP_SURFACE=full bun run mcp`
- HTTP (local dev path): `http://localhost:4111/api/mcp/fpf_memory/mcp` via `mastra dev`
- server name: `fpf_memory`
- protocol version: `2024-11-05`

The hosted server exposes only the 3 public tools. Local stdio and local HTTP default to the same public surface; set `FPF_MCP_SURFACE=full` to expose all 9 tools for local expert work.

## Codex Setup

Default `~/.codex/config.toml` entry:

```toml
[mcp_servers.fpf_memory]
url = "https://fpf-memory-remote-20260414.server.mastra.cloud/api/mcp/fpf_memory/mcp"
```

This repo ships the same hosted configuration at `.codex/config.toml` and `.mcp.json`. Codex will load that file after the project is trusted.

For temporary local expert work, point a client at `src/mastra/stdio.ts` and set `FPF_MCP_SURFACE=full`.

## Tool Catalog

### Public tools (hosted default surface)

#### `ask_fpf`

Return a markdown-first grounded answer envelope over the same runtime.

#### `query_fpf_spec`

Answer a question with deterministic grounding, citations, constraints, and freshness metadata.

#### `get_fpf_index_status`

Report whether the current runtime index exists, whether it is fresh against the current source hash, and which artifacts are present.

### Expert tools (local full-surface runtime only)

#### `refresh_fpf_index`

Build or rebuild the compiler-backed vectorless index from `FPF-spec.md` and persist the runtime artifact set under `.runtime/fpf-index/`.

#### `trace_fpf_path`

Return the retrieval trace used for a question, including candidate scores, graph expansion, and selected anchors.

#### `inspect_fpf_node`

Inspect one pattern, route, or lexeme and return anchors, neighboring relations, and stable document references.

#### `read_fpf_doc`

Resolve a pattern, route, or lexeme to the canonical generated markdown page and return the selected document node, stable paths, and exact generated markdown text.

#### `inspect_fpf_anchor`

Inspect one exact anchor ID and return raw anchor text plus owning-node context.

#### `expand_fpf_citations`

Expand multiple citation IDs into raw anchor text plus owning-node context without adding new semantics.

## Direct Document Contract

Canonical markdown paths preserve the current generated naming contract:

- patterns: `docs/generated/patterns/<ID>.md`
- routes: `docs/generated/routes/route_<slug>.md`
- preface pages: `docs/generated/preface/heading_<slug>_<lineStart>.md`

Static routes mirror those pages under `/generated/**` with clean URLs and `.html` emitted into ignored `doc_build/`.

## Verification

Typical checks:

```bash
bun run check
bun run test
curl -X POST https://fpf-memory-remote-20260414.server.mastra.cloud/api/mcp/fpf_memory/tools/get_fpf_index_status/execute \
  -H 'content-type: application/json' \
  -d '{"data":{}}'
FPF_MCP_SURFACE=full bun run mcp
```
