---
title: FPF Spec Runtime
description: Bun-first Mastra runtime and generated reference docs for FPF-spec.md.
---

# FPF Spec Runtime

This site is generated from the local `FPF-spec.md` source and the compiler snapshot used by the runtime itself.

## Stack

- Bun is the preferred local runtime and package manager.
- Mastra remains the runtime and MCP framework of choice in this repo.
- Effect Schema owns repo-authored MCP contracts at the Mastra boundary.
- Rstest, Rslint, and Rspress provide the test, lint, and docs surfaces.

## Reference Surfaces

- [Pattern catalog](/generated/patterns/)
- [Route catalog](/generated/routes/)
- [Preface and non-pattern sections](/generated/preface/)

## Runtime Surfaces

- `query_fpf_spec`: synthesized answer envelope
- `trace_fpf_path`: deterministic retrieval evidence
- `inspect_fpf_node`: node expansion
- `inspect_fpf_anchor`: single anchor expansion
- `expand_fpf_citations`: batch citation expansion

## Notes

- Generated pages are rebuilt from the compiler snapshot during `bun run docs:build`.
- The docs site is a presentation layer only; the runtime and MCP behavior remain owned by the Mastra surfaces under `src/mastra/`.
