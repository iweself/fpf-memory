# Runtime Surface Alignment

Route: `A.1.1 -> A.15 -> A.15.2/A.15.3 -> B.5.1`, landing on `F.17`.

## Contexts

- `Ctx.Core`: compiled FPF domain types, lexical projection, deterministic retrieval helpers
- `Ctx.App`: transport-agnostic commands, outcomes, and app services
- `Ctx.Run.MCP`: MCP tool contracts, tool wiring, and stdio/server composition
- `Ctx.Run.Hosted`: hosted Mastra/Hono bootstrap and deploy-facing runtime surface
- `Ctx.Docs`: deterministic docs generation and publication projection
- `Ctx.Build`: build artefact manifests and hosted staging
- `Ctx.Infra`: env parsing, logging, observability, filesystem and model-adapter concerns
- `Ctx.Compat.Mastra`: explicit compatibility bootstrap layer for Mastra-required import-time surfaces

## Alignment

- Role: serve FPF retrieval, inspection, tracing, staging, and publication without collapsing transport boundaries into core logic.
- Method: adapters validate edge contracts, map into app commands, and call shared runtime/app services.
- Plan: build, docs, hosted deploy, and MCP boot are separate planned works with their own config and verification paths.
- Work: runtime refresh/query/trace, docs generation, and deploy staging each emit their own outcomes or manifests.
- Composition modules are the approved bridge layer between app services and transport/bootstrap contexts.

## Boundary Laws

- `Ctx.Core` imports only `Ctx.Core`.
- `Ctx.App` depends on `Ctx.Core` plus app-local ports and outcomes.
- `Ctx.Run.MCP` and `Ctx.Run.Hosted` do not import each other.
- `Ctx.Docs` and `Ctx.Build` do not depend on runtime adapters or entrypoints.
- Only `Ctx.Compat.Mastra` may consume composition for import-time bootstrap compatibility.
- Only the documented shims `src/mastra/index.ts` and `src/mastra/mcp/server.ts` may import `Ctx.Compat.Mastra`.
- Entry points import composition roots only.

## Lifecycle Matrix

| Artifact | Owner Context | Lifecycle State | Note |
| --- | --- | --- | --- |
| `BuildArtifactManifest` | `Ctx.Build` | `operation` | Records hosted staging work that has been enacted. |
| `GenerateDocsResult` | `Ctx.Docs` | `evidence` | Records deterministic publication output from the compiled spec. |
| runtime query / trace / status surfaces | `Ctx.Run.MCP` or `Ctx.Run.Hosted` | `operation` | Operational outputs stay transport-facing and are not retyped as build artifacts. |

## Compat Exceptions

| Surface | Status | Allowed Dependency | Reason |
| --- | --- | --- | --- |
| `src/compat/mastra/*` | canonical compat implementation | `src/composition/*` | Holds the governed bootstrap exception for Mastra integration. |
| `src/mastra/index.ts` | thin shim | `src/compat/mastra/runtime.ts` | Required by `mastra build` / `mastra deploy`. |
| `src/mastra/mcp/server.ts` | thin shim | `src/compat/mastra/mcp-server.ts` | Preserves the legacy import surface without making it canonical. |

## Evidence

- `bun run check:boundaries`
- `bun run check`
- `bun run test`

## Diagrams

- See [diagram-pack.md](./diagram-pack.md) for the skill-generated HTML diagram pack that describes the context map, runtime flow, and refactor delta.
