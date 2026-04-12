---
title: "DRR-0001: MCP As The First-Class Codex Interface"
description: "Design-Rationale Record for the Codex-facing interface decision in fpf_memory."
---

# DRR-0001: MCP As The First-Class Codex Interface

Status: accepted for the bounded context `CodexAccess:LocalFPFSpecRuntime`

## Problem frame

`fpf_memory` needs a Codex-facing interface for grounded access to the local `FPF-spec.md` runtime. The repo already exposes a local MCP server, a Bun CLI, and a hosted Hono/Mastra runtime path, but the interface promise was implicit rather than recorded as an explicit decision.

Without a documented decision, the same word "interface" can collapse several different things:

- the thing itself: the local runtime over `FPF-spec.md`
- the access point: stdio or HTTP transport
- the public promise: what Codex can ask for
- the delivery work and evidence: traces, freshness checks, verification runs

That ambiguity is exactly the sort of boundary drift FPF warns against. A Codex setup PR should therefore carry an explicit rationale record instead of relying on README prose and local memory.

## Decision

For the bounded context `CodexAccess:LocalFPFSpecRuntime`, `fpf_memory` adopts **MCP as the first-class agent-facing interface**.

The decision includes these commitments:

1. The primary Codex integration surface is the `fpf_memory` MCP server.
2. The CLI remains an operator/debug surface, not the primary semantic boundary for agent use.
3. Hosted HTTP remains a transport/hosting option, not the first interface to optimize for in this repo slice.
4. The Codex registration path is documented and packaged around the stdio entry point:
   `node --import tsx src/mcp-stdio.ts`
5. This decision is recorded as a DRR outside the normative FPF core, consistent with `E.9`.

## Rationale

This choice keeps the FPF layers separate.

- **Promise content:** Codex can ask for grounded answers, structured envelopes, exact generated docs, retrieval traces, status, and refresh.
- **Ability:** the repo already implements those capabilities in the local runtime and MCP server.
- **Performance / work evidence:** the repo can verify the launcher and runtime behavior through local CLI checks, MCP startup checks, and the verification script.

Why MCP, rather than the alternatives:

- **Against CLI-first:** the CLI is useful for operators and smoke tests, but it is not the native tool-selection boundary for Codex.
- **Against custom HTTP-first:** Codex already supports MCP natively, so a bespoke API would add interface work without solving the current local integration problem.
- **For MCP-first:** the repo already ships an MCP server, Codex natively supports MCP configuration, and the server contract matches the bounded need for grounded retrieval over local spec artifacts.

This also follows FPF boundary discipline:

- `A.2.3`: keep promise, capability, and work evidence distinct.
- `E.10.D2`: do not collapse thing, description, and actual work.
- `A.6.8`: avoid vague service-language blobs; name the boundary facet explicitly.

The current caveat is not protocol fitness but surface shape. The repo is still tool-heavy and discovery-light. That is a later ergonomics problem, tracked separately, and does not overturn the MCP-first decision.

## Consequences

Positive consequences:

- The PR can point to one explicit decision record instead of spreading rationale across comments and setup docs.
- Codex setup, packaging metadata, and verification can all align around a single published interface decision.
- Future work can distinguish between:
  - boundary choice: MCP-first
  - transport choice: stdio now, HTTP optional later
  - surface-shape work: discovery, browse/search, tools/resources/prompts

Trade-offs and follow-up consequences:

- A tool-only MCP surface is still heavier than ideal for first-pass discovery, so later work should improve discovery without changing this decision.
- Documentation now has one more artifact to keep current; that is acceptable because the DRR is the durable rationale carrier.
- If the bounded context changes from local Codex use to a hosted multi-tenant product, a later DRR may designate HTTP as an additional first-class external boundary for that different scope.

References:

- `E.9` Design-Rationale Record method
- `A.2.3` promise / capability / work distinctions
- `E.10.D2` thing / description / work separation
- `A.6.8` boundary-language discipline
- Issue `#14` for Codex packaging and setup
- Issue `#15` for later discovery-layer ergonomics
