---
title: MCP Interface
description: Spec-oriented interface contract for the fpf_memory stdio MCP server.
---

# MCP Interface

This page documents the public MCP wire contract implemented by the `fpf_memory` server.

Mastra and the upstream MCP SDK own the low-level protocol machinery. This repo owns the tool catalog, tool ids, tool descriptions, and tool input/output payloads.

## Transport

- Transport: stdio
- Implementation owner: Mastra `MCPServer`
- Entry point: `bun run mcp`
- Server name: `fpf_memory`
- Default protocol version: `2024-11-05`

Hosted/server surfaces use the Mastra Hono adapter under `src/mastra.ts` and `src/server.ts`.

## Lifecycle

The server supports these MCP methods:

- `initialize`
- `notifications/initialized`
- `ping`
- `tools/list`
- `tools/call`

### Initialize

Request:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": {
      "name": "example-client",
      "version": "1.0.0"
    }
  }
}
```

Response:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "tools": {}
    },
    "serverInfo": {
      "name": "fpf_memory",
      "version": "1.0.0"
    }
  }
}
```

### Initialized notification

After `initialize`, the client should send:

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/initialized"
}
```

This notification has no response body.

### Ping

Request:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "ping"
}
```

Response:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {}
}
```

## Tool listing

`tools/list` returns the full tool catalog with plain draft-07 JSON Schema input objects.

Request:

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/list"
}
```

Response shape:

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "tools": [
      {
        "name": "ask_fpf",
        "description": "Return an FPF answer in markdown with grounding metadata using the local vectorless runtime.",
        "inputSchema": {
          "type": "object"
        },
        "outputSchema": {
          "type": "object"
        }
      }
    ]
  }
}
```

Notes:

- Tool names are canonical snake_case only.
- `inputSchema` is always a plain JSON Schema object.
- `outputSchema` is also advertised by the current Mastra MCP server for these tools.

## Tool calling

`tools/call` uses:

- `params.name`: the exact tool name
- `params.arguments`: the tool input object

Example request:

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "ask_fpf",
    "arguments": {
      "question": "Give me a checklist for how to model my project's information system."
    }
  }
}
```

Successful tool responses use this envelope:

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\n  \"question\": \"...\",\n  \"mode\": \"verbose\"\n}"
      }
    ],
    "structuredContent": {
      "question": "Give me a checklist for how to model my project's information system.",
      "mode": "verbose"
    }
  }
}
```

Tool-level validation and execution failures are surfaced by Mastra’s MCP implementation. This repo does not add custom JSON-RPC error wrapping on top of that server behavior.

## JSON-RPC error behavior

Protocol-level JSON-RPC errors are owned by Mastra and the upstream MCP SDK. Clients should treat those as transport/protocol failures rather than repo-authored tool semantics.

## Tool catalog

### `refresh_fpf_index`

Parameters:

- `force?: boolean`

Input:

```json
{
  "force": true
}
```

Output:

- build audit for the local artifact refresh
- includes source hash, previous hash, rebuild reason, validation counts, compiler counts, and artifact paths

### `get_fpf_index_status`

Parameters:

- none

Input:

```json
{}
```

Input schema:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

Output:

- runtime freshness
- artifact presence
- synthesizer configuration
- observability configuration
- session cache state

### `query_fpf_spec`

Parameters:

- `question: string`
- `mode?: "compact" | "verbose" | "proof"`
- `forceRefresh?: boolean`
- `sessionId?: string`

Input:

```json
{
  "question": "What is U.BoundedContext?",
  "mode": "verbose",
  "forceRefresh": false,
  "sessionId": "s1"
}
```

Defaults:

- `mode` defaults from `FPF_QUERY_DEFAULT_MODE`
- repo default is `verbose`

Output:

- `mode`
- `question`
- `answer`
- `ids`
- `relations`
- `constraints`
- `citations`
- `confidence`
- `gaps`
- `status`
- `snapshot`
- optional `groundingChain`

LM use:

- may use the optional LM Studio synthesizer

### `ask_fpf`

Parameters:

- `question: string`
- `mode?: "compact" | "verbose" | "proof"`
- `forceRefresh?: boolean`
- `sessionId?: string`

Input:

```json
{
  "question": "Give me a checklist for how to model my project's information system.",
  "mode": "proof"
}
```

Defaults:

- `mode` defaults from `FPF_QUERY_DEFAULT_MODE`
- repo default is `verbose`

Output:

- `question`
- `mode`
- `markdown`
- `ids`
- `citations`
- `constraints`
- `gaps`
- `confidence`
- `status`
- `snapshot`
- optional `groundingChain`

LM use:

- may use the optional LM Studio synthesizer

### `trace_fpf_path`

Parameters:

- `question: string`
- `mode?: "compact" | "verbose" | "proof"`
- `forceRefresh?: boolean`
- `sessionId?: string`

Input:

```json
{
  "question": "How do U.RoleAssignment and U.BoundedContext connect?",
  "mode": "proof",
  "sessionId": "s1"
}
```

Defaults:

- `mode` defaults to `compact`

Output:

- normalized question
- detected IDs / lexemes / route names
- candidate scores
- frontier candidates
- graph expansions
- selected nodes and anchors
- followed references
- retrieval hops
- session reuse metadata
- sufficiency flag
- snapshot

LM use:

- deterministic only

### `inspect_fpf_node`

Parameters:

- `selector: string`
- `kind?: "auto" | "id" | "route" | "lexeme"`
- `forceRefresh?: boolean`

Input:

```json
{
  "selector": "A.1.1",
  "kind": "id",
  "forceRefresh": false
}
```

Output:

- resolved node
- node anchors
- neighboring relations
- snapshot metadata

### `inspect_fpf_anchor`

Parameters:

- `anchorId: string`
- `forceRefresh?: boolean`

Input:

```json
{
  "anchorId": "A.1.1:4.1",
  "forceRefresh": false
}
```

Output:

- raw anchor text
- owning node context
- neighboring relations
- snapshot metadata

### `expand_fpf_citations`

Parameters:

- `citationIds: string[]`
- `forceRefresh?: boolean`

Input:

```json
{
  "citationIds": [
    "A.1.1:4.1",
    "Preface/Where to start",
    "missing-citation"
  ],
  "forceRefresh": false
}
```

Output:

- requested `citationIds`
- per-citation expansion results in input order
- `ok` or `not_found` per item
- raw anchor text plus owning node context for resolved citations
- snapshot metadata

## Operational notes

- `query_fpf_spec` and `ask_fpf` are the only tools that may use the optional LM Studio path.
- `trace_fpf_path`, `inspect_fpf_node`, `inspect_fpf_anchor`, and `expand_fpf_citations` stay deterministic.
- Missing tool arguments are normalized to `{}` for object-shaped schemas.
- The server validates both tool input and tool output against repo-owned Zod contracts before returning a result.

## Verification

The implemented protocol and tool surface are verified in:

- `tests/mcp-server.test.ts`
- `src/mcp/server.ts`
- `src/mcp/tools.ts`
- `src/mcp/tool-contracts.ts`
