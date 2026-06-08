---
title: "What Do I Need To Run?"
description: "Use the hosted FPF Reference MCP server from a local MCP client. No local server required."
outline: false
---

# What do I need to run?

You do not need to run an FPF server. You only need an MCP client that supports remote HTTP MCP servers.

Paste these values into the client.

| Field | Value |
| --- | --- |
| Name | `fpf_reference` |
| Transport | `HTTP` or `Streamable HTTP` |
| URL | `https://mcp.fpf.sh/api/mcp/fpf_reference/mcp` |
| Auth | None |

If the client asks for a local command, choose its remote HTTP server option instead.

After saving the server, confirm the client shows these tools:

- `browse_fpf_catalog`
- `search_fpf`
- `ask_fpf`
- `query_fpf_spec`
- `read_fpf_doc`
- `get_fpf_index_status`

First check:

```txt
Call get_fpf_index_status.
```

Good first prompt:

```txt
Use only fpf_reference. First call get_fpf_index_status. If the index is available, find the smallest FPF route for this work: <describe work>. Return Context | Route ID | Ordered IDs | Acceptance check | Next move.
```

Opening the endpoint in a browser returns `405 Method Not Allowed`. That is expected; the URL is for MCP clients.

For product-specific setup screens, use [Connect MCP](/connect-mcp).
