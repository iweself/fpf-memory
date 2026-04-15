# FPF Runtime Diagram Pack

This repo keeps one diagram carrier only:

- `HTML pack`: standalone dark-themed HTML pages with inline SVG graphics, emitted by the checked-in generator script (same visual style as the `architecture-diagram` skill workflow)

The HTML files under `docs/architecture/html/` are **not committed** (they go stale quickly). Generate them locally when needed:

```bash
bun run diagrams:generate
```

Then open `docs/architecture/html/index.html` from disk or a local static server.

Each HTML page is viewpoint-scoped and follows the same FPF split used in the architecture notes: bounded contexts, boundary faces, runtime work, lifecycle governance, and refactor delta stay separate instead of collapsing into one poster.

## High-Level Views

### Bounded Context Map

What it explains: the named contexts, the approved bridge layer, the governed Mastra compat exception, and where optional local LLM synthesis actually lives.

- HTML: `docs/architecture/html/fpf-runtime-bounded-context-map.html`

### Boundary Faces

What it explains: MCP, CLI, hosted, docs, and build are boundary faces with distinct promises and contracts; the optional LLM is behind the runtime boundary rather than being a face of its own.

- HTML: `docs/architecture/html/fpf-runtime-boundary-faces.html`

### Role / Method / Work Stack

What it explains: role, capability, method, plan, work, and evidence stay distinct, and the optional LLM belongs to one bounded mechanism inside runtime work.

- HTML: `docs/architecture/html/fpf-runtime-role-method-work-stack.html`

### Lifecycle and Compat Governance

What it explains: which artifacts belong to which context, what lifecycle state they represent, and which rows are deterministic versus optionally synthesized.

- HTML: `docs/architecture/html/fpf-runtime-lifecycle-compat-governance.html`

## Detailed Views

### Detailed Context Map

What it explains: the repo-specific responsibilities inside each context, with composition and local synthesis called out explicitly.

- HTML: `docs/architecture/html/fpf-runtime-detailed-context-map.html`

### Runtime Request Flow

What it explains: the query path runs deterministic retrieval first, optional local synthesis second, and keeps docs/build publication on a separate path.

- HTML: `docs/architecture/html/fpf-runtime-request-flow.html`

### Before / After Refactor

What it explains: the architectural delta this refactor introduced, including the now-explicit LLM boundary.

- HTML: `docs/architecture/html/fpf-runtime-before-after-refactor.html`

## Combined Overview Boards

These overview posters are still useful, but they are intentionally secondary to the viewpoint-scoped pages:

- HTML: `docs/architecture/html/fpf-runtime-architecture-pack.html`
- HTML: `docs/architecture/html/fpf-runtime-detailed-views.html`

## Coverage

- `A.1.1`: bounded contexts and explicit bridge ownership
- `A.6`, `A.6.B`, `A.6.C`: boundary faces and contract surfaces
- `A.15`: role, method, plan, and work separation
- `B.5.1`: lifecycle state tagging
- `C.24`: checkpointing and governed rollout discipline

## Notes

- For build outputs and ignored directories (`.mastra`, `.runtime`, `dist`, `doc_build`, `docs/generated`, `docs/architecture/html`), see [artifact-directories.md](./artifact-directories.md).
- The HTML pack is regenerated locally (`bun run diagrams:generate`); it is not kept in version control.
- Hybrid alignment rule: keep diagrams conceptual, but each diagram page must include a compact current-surface inventory card (public MCP tools, full-surface additions, and active app-service families) so diagram claims stay auditable against code.
- If the architecture changes, regenerate or revise the HTML pack in [`scripts/generate-architecture-diagrams.ts`](../../scripts/generate-architecture-diagrams.ts) and run `diagrams:generate`.
