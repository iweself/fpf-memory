---
title: "Automation scripts"
description: "What each script under scripts/ does, how to run it, and how it connects to CI and deploy."
---

# Automation scripts

Reference for every Bun or shell script under [`scripts/`](../scripts/). Each entry lists purpose, how it is invoked, configuration, outputs, and how it fits CI or deploy.

---

## `generate-docs.ts` (`bun run docs:generate`)

**Purpose:** Compile the FPF spec markdown into **Rspress-ready markdown** under `docs/generated/**`. Deletes the previous `docs/generated` tree first, then writes one file per projected page (patterns, routes, preface headings, indexes).

**Implementation:** Thin CLI over [`generateDocsSite`](../src/adapters/docs/generate.ts), which runs `compileFpfSource`, `buildDocsProjection`, and writes files using `docsRelativePath` so on-disk paths match logical paths like `docs/generated/patterns/A.1.md`.

**Configuration (environment):**

| Variable | Role |
|----------|------|
| `FPF_SPEC_SOURCE_PATH` | Spec file to compile (default from [`DEFAULT_SOURCE_PATH`](../src/core/constants.ts), typically `.fpf-upstream/FPF-Spec.md`) |
| `FPF_DOCS_ROOT` | Rspress content root (default `docs`) |

Parsed via [`parseDocsConfig`](../src/adapters/infra/config/env.ts).

**Stdout:** JSON with `sourcePath`, `sourceHash`, `builtAt`, `docsRoot`, `generatedFiles`.

**Outputs:** `docs/generated/` (gitignored in this repo). Required before `rspress dev` / `rspress build` so routes and sidebars resolve.

**When to run:** After `spec:download` or whenever the spec changes. CI runs it after downloading the spec; `docs:build` runs it automatically before `rspress build`.

**Failure modes:** Missing or unreadable spec path; compiler errors on invalid spec content.

---

## `download-upstream-spec.ts` (`bun run spec:download`)

**Purpose:** Fetch the **canonical spec markdown** over HTTP and write it to a local file so nothing under `FPF_SPEC_SOURCE_PATH` needs to live in git.

**Configuration:**

| Variable | Default |
|----------|---------|
| `FPF_UPSTREAM_SPEC_URL` | `https://raw.githubusercontent.com/venikman/fpf-sync/main/FPF/FPF-Spec.md` |
| `FPF_DOWNLOAD_SPEC_OUTPUT` | `.fpf-upstream/FPF-Spec.md` |

**Behavior:** `fetch(url)`; non-OK status prints to stderr and exits `1`. Writes UTF-8 text; creates parent directories.

**Stdout:** JSON with `url`, absolute `outputPath`, `bytes`.

**Outputs:** Default file under `.fpf-upstream/` (gitignored).

**When to run:** Fresh clone, or when you want CI/local to match upstream `main` without a `fpf-sync` git checkout.

**Failure modes:** Network errors; 404 if URL or branch is wrong; permission errors writing the output path.

---

## `prepare-deploy.ts` (`bun run predeploy`)

**Purpose:** **Stage the minimum hosted bundle**: the runtime source file (copied under `.fpf-upstream/FPF-Spec.md` in the hosted public tree so it matches the runtime default) and `snapshot.json` under `public/.runtime/fpf-index/`, after ensuring the index is current.

**Flow:**

1. [`prepare-deploy.ts`](../scripts/prepare-deploy.ts): calls [`stageDeployAssets`](../src/build/stage-deploy-assets.ts) with [`parseBuildConfigFromEnv`](../src/adapters/infra/config/env.ts) and the current `process.env`.

**What `stageDeployAssets` does:**

- Builds a configured [`FpfRuntime`](../src/runtime/runtime.ts) from `env` and runs **`refresh(false)`** so `snapshot.json` exists under `FPF_RUNTIME_ARTIFACT_DIR`.
- Copies **`config.sourcePath`** (resolved from cwd) → `hostedPublicDir/.fpf-upstream/FPF-Spec.md` so deployed bundles keep the same relative source path as local defaults.
- Copies **`artifactDir/snapshot.json`** → `hostedPublicDir/.runtime/fpf-index/snapshot.json`.

**Configuration:** `FPF_SPEC_SOURCE_PATH`, `FPF_RUNTIME_ARTIFACT_DIR`, `FPF_HOSTED_PUBLIC_DIR` (default `src/mastra/public` from build config), plus any other env the runtime needs for `createConfiguredRuntime`.

**Stdout:** JSON manifest (`BuildArtifactManifest`) listing staged artifacts and metadata.

**Outputs:** Files under `src/mastra/public/` (gitignored as a tree in this repo). Other compiler artifacts (index-map, graphs, etc.) are **not** staged; the hosted runtime only needs source + snapshot for the paths used here.

**When to run:** Before `bun run deploy` (Mastra build/deploy), which runs `predeploy` first.

**Failure modes:** Refresh or copy failures; wrong `hostedPublicDir` so deploy reads the wrong tree.

---

## `fixup-stdio-build.ts` (`bun run build:mcp`)

**Purpose:** Make the published MCP stdio entrypoint under `dist/stdio.js` executable as a package `bin`, with a Node shebang for direct invocation.

**Flow:**

1. `build:mcp` runs `tsup src/mastra/stdio.ts --format esm --out-dir dist --no-splitting`.
2. [`fixup-stdio-build.ts`](../scripts/fixup-stdio-build.ts) reads `dist/stdio.js`.
3. If the file does not already start with `#!/usr/bin/env node`, it prepends the shebang.
4. It sets mode `755` so the entrypoint can be executed directly.

**Outputs:** Mutates `dist/stdio.js` in place after bundling.

**When to run:** Automatically as part of `bun run build:mcp` and therefore `bun run build`.

**Failure modes:** Missing `dist/stdio.js`; permission errors changing file mode.

---

## `verify-runtime.sh` (`./scripts/verify-runtime.sh`)

**Purpose:** **End-to-end smoke verification** of real binaries: typecheck, CLI, MCP stdio (via `bun run mcp` and direct `bun src/mastra/stdio.ts`), hosted server startup, and optional LM Studio logging when env is set.

**Preamble:** Resolves repo root, checks the spec file exists (default `FPF_SPEC_SOURCE_PATH` or `.fpf-upstream/FPF-Spec.md`); exits with a hint to run `spec:download` if missing.

**Steps (always):**

1. `bun run check` (TypeScript).
2. `bun run cli -- status` — asserts Mastra log file grows and contains `"msg":"CLI command start"` and `"CLI command finished"`.
3. Brief `bun run mcp` — asserts log contains `"msg":"MCP stdio server start"`.
4. Brief `bun src/mastra/stdio.ts` via FIFO — same startup log check on appended bytes.
5. `bun run start` with `PORT` defaulting to `42111` (`FPF_VERIFY_PORT`) — polls until log shows `"msg":"Mastra Hono server start"` or times out (15s).

**Optional block:** If `FPF_LOCAL_LLM_BASE_URL` or `FPF_LOCAL_LLM_MODEL` is set, runs `bun run cli -- query` with `FPF_VERIFY_QUERY` / `FPF_VERIFY_MODE` and asserts observability and AI trace logs grow and contain expected JSON keys.

**Log paths:** `FPF_MASTRA_LOG_PATH`, `FPF_MASTRA_OBSERVABILITY_PATH`, `FPF_AI_TRACE_LOG_PATH` (defaults under `.runtime/logs/`); relative paths are resolved from repo root.

**When to run:** Locally before a release; documented in README “Real Verification”. Not wired into default CI in this repo unless you add a workflow step.

**Failure modes:** Missing spec; log grep misses (ordering, log level); hosted port conflict; LM branch assertions if env half-set.

---

## `check-boundaries.ts` (`bun run check:boundaries`)

**Purpose:** **Static architecture guard** on `src/**/*.ts(x)` — enforce allowed import edges between governed “context” folders (Core, App, Compat/Mastra, MCP vs Hosted, Docs/Build vs runtime adapters, entrypoints only to composition).

**Mechanism:** TypeScript compiler API walks each file’s relative imports, resolves targets on disk, then [`evaluateBoundaryRule`](../scripts/check-boundaries.ts) returns a human-readable violation string when an import crosses a forbidden boundary (e.g. `Ctx.App` importing `src/adapters/`, MCP adapter importing hosted, etc.).

**Configuration:** None; root defaults to `process.cwd()`.

**Stdout:** `Boundary check passed.` or throws with a list of violations.

**Outputs:** None on disk.

**When to run:** CI (`check:boundaries` job) and locally after refactors that touch `src/` layering.

**Failure modes:** New imports that violate documented shim or composition rules; false positives if path layout changes without updating the rule table.

---

## `generate-architecture-diagrams.ts` (`bun run diagrams:generate`)

**Purpose:** Regenerate the **standalone HTML diagram pack** under `docs/architecture/html/`: dark-themed pages with inline SVG and a generated `index.html` linking all views (bounded context map, boundary faces, request flow, lifecycle governance, etc.).

**Mechanism:** Large in-script template data; [`main`](../scripts/generate-architecture-diagrams.ts) ensures `docs/architecture/html` exists, **deletes existing `*.html`** in that directory, writes each diagram page, then writes `index.html`.

**Configuration:** None (output directory is fixed relative to cwd).

**Outputs:** `docs/architecture/html/*.html` (gitignored in this repo).

**When to run:** Whenever architecture copy or visuals should be refreshed for local review; not part of default CI or docs deploy.

**Failure modes:** Write permission; accidental loss of hand-edits if someone edited generated HTML in place (regeneration overwrites).

---

## Quick map to `package.json` scripts

| npm script | Script file |
|------------|-------------|
| `docs:generate` | `scripts/generate-docs.ts` |
| `spec:download` | `scripts/download-upstream-spec.ts` |
| `build:mcp` | `scripts/fixup-stdio-build.ts` (after `tsup`) |
| `predeploy` | `scripts/prepare-deploy.ts` |
| `check:boundaries` | `scripts/check-boundaries.ts` |
| `diagrams:generate` | `scripts/generate-architecture-diagrams.ts` |

`verify-runtime.sh` is run directly: `./scripts/verify-runtime.sh`.

## Related

- [Root-folder contract](./architecture/artifact-directories.md) — canonical top-level directory roles plus generated-output paths.
- [README](../README.md) — environment variables and first-time clone steps.
