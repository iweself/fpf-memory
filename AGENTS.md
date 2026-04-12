# fpf_memory MCP Usage

Use the `fpf_memory` MCP server whenever the task requires grounded answers, exact FPF IDs, canonical generated docs, or deterministic retrieval provenance from the local `FPF-spec.md` runtime.

Prefer these tools:

- `ask_fpf` for markdown-first answers
- `query_fpf_spec` for structured answer envelopes
- `read_fpf_doc` for exact generated markdown pages
- `trace_fpf_path` for retrieval evidence and provenance
- `get_fpf_index_status` or `refresh_fpf_index` for runtime freshness checks
