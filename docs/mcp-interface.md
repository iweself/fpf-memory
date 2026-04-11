---
title: "MCP Interface"
description: "Tool contract for the local vectorless FPF runtime."
---

# MCP Interface

The MCP server exposes a deterministic local runtime over `FPF-spec.md`. It uses `.runtime/fpf-index/*` for retrieval artifacts and `docs/generated/**` for canonical publishable markdown.

## Tools

### `refresh_fpf_index`

Build or rebuild the local vectorless index from `FPF-spec.md` and persist the runtime artifact set under `.runtime/fpf-index/`.

### `get_fpf_index_status`

Report whether the local index exists, whether it is fresh against the current source hash, and which artifacts are present.

### `query_fpf_spec`

Answer a question with deterministic grounding, citations, constraints, and freshness metadata.

### `trace_fpf_path`

Return the retrieval trace used for a question, including candidate scores, graph expansion, and selected anchors.

### `inspect_fpf_node`

Inspect one pattern, route, or lexeme and return anchors, neighboring relations, and stable doc references.

### `read_fpf_doc`

Resolve a pattern, route, or lexeme to the canonical generated markdown page and return:

- the selected document node
- the stable markdown path
- the stable static path
- the exact generated markdown text

## Direct document contract

Canonical markdown paths preserve the current generated naming contract:

- patterns: `docs/generated/patterns/<ID>.md`
- routes: `docs/generated/routes/route_<slug>.md`
- preface pages: `docs/generated/preface/heading_<slug>_<lineStart>.md`

Static routes mirror those pages under `/generated/**` with clean URLs and `.html` emitted into ignored `doc_build/`.
