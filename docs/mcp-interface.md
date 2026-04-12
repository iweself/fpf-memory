---
title: "MCP Interface"
description: "Spec-oriented interface contract for the local FPF stdio MCP server."
---

# MCP Interface

This page documents the public MCP surface implemented by `fpf_memory`.

Decision record:

- [DRR-0001: MCP As The First-Class Codex Interface](/drr/DRR-0001-mcp-first-class-interface/)

The runtime itself is compiler-backed and local:

- authored source: `FPF-spec.md`
- runtime artifacts: `.runtime/fpf-index/*`
- canonical publishable markdown: `docs/generated/**`
- static docs build: ignored `doc_build/`

## Transport

- stdio (local): `bun run mcp`
- HTTP (local): `http://localhost:4111/api/mcp/fpf_memory/mcp` via `mastra dev`
- server name: `fpf_memory`
- protocol version: `2024-11-05`

Both stdio and HTTP default to the public tool surface (3 tools). Set `FPF_MCP_SURFACE=full` for all 9 tools.

## Codex Setup

Codex desktop app fields:

- command: `bun`
- arguments: `src/mastra/stdio.ts`
- working directory: absolute path to the local repo root

Equivalent `~/.codex/config.toml` entry:

```toml
[mcp_servers.fpf_memory]
command = "bun"
args = ["src/mastra/stdio.ts"]
cwd = "/absolute/path/to/fpf-memory"
required = false
startup_timeout_sec = 15
tool_timeout_sec = 60
```

This repo also ships the same project-scoped configuration at `.codex/config.toml`. Codex will load that file after the project is trusted.

## Tool Catalog

### Public tools (default surface)

#### `ask_fpf`

Return a markdown-first grounded answer envelope over the same runtime.

#### `query_fpf_spec`

Answer a question with deterministic grounding, citations, constraints, and freshness metadata.

#### `get_fpf_index_status`

Report whether the local index exists, whether it is fresh against the current source hash, and which artifacts are present.

### Expert tools (FPF_MCP_SURFACE=full)

#### `refresh_fpf_index`

Build or rebuild the local vectorless index from `FPF-spec.md` and persist the runtime artifact set under `.runtime/fpf-index/`.

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

Typical local checks:

```bash
bun run check
bun run test
bun run docs:build
bun run cli -- read-doc --selector "A.1.1"
bun run mcp
```
