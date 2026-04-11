---
title: FPF Spec Runtime
description: Bun-first Mastra runtime and generated reference docs for FPF-spec.md.
---

# FPF Spec Runtime

This site is generated from the local `FPF-spec.md` source and the compiler snapshot used by the runtime itself.

## Stack

- Bun is the preferred local runtime and package manager.
- Zod owns repo-authored contracts and validation.
- Mastra owns the MCP, logging, and observability boundary.
- Hono is the hosted server engine.
- Rstest, Rslint, and Rspress provide the test, lint, and docs surfaces.

## Reference Surfaces

- [Pattern catalog](/generated/patterns/)
- [Route catalog](/generated/routes/)
- [Preface and non-pattern sections](/generated/preface/)
- [MCP interface contract](/mcp-interface/)

## Runtime Surfaces

- `ask_fpf`: markdown-first grounded answer surface
- `query_fpf_spec`: synthesized answer envelope
- `trace_fpf_path`: deterministic retrieval evidence
- `inspect_fpf_node`: node expansion
- `inspect_fpf_anchor`: single anchor expansion
- `expand_fpf_citations`: batch citation expansion

## Notes

- Generated pages are rebuilt from the compiler snapshot during `bun run docs:build`.
- The docs site is a presentation layer only; the runtime behavior lives under `src/runtime/`, the MCP surface under `src/mcp/`, and the hosted server bootstrap under `src/mastra.ts` and `src/server.ts`.
