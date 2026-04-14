# fpf_memory MCP Usage

Use the `fpf_memory` MCP server whenever the task requires grounded answers, exact FPF IDs, canonical generated docs, or deterministic retrieval provenance from the local `FPF-spec.md` runtime.

Public tools (deployed MCP surface):

- `ask_fpf` for markdown-first answers
- `query_fpf_spec` for structured answer envelopes
- `get_fpf_index_status` for runtime freshness checks

Expert tools (local full-surface runtime only, via `FPF_MCP_SURFACE=full bun run mcp`):

- `read_fpf_doc` for exact generated markdown pages
- `trace_fpf_path` for retrieval evidence and provenance
- `inspect_fpf_node`, `inspect_fpf_anchor`, `expand_fpf_citations` for deep inspection
- `refresh_fpf_index` to rebuild the local artifact set
