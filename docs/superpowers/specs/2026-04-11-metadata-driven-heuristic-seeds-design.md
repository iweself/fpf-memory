# Design: Metadata-Driven Heuristic Seeds and Route Constraints

**Issue:** #4 — Replace hard-coded heuristic seeds and route special-casing with metadata  
**Date:** 2026-04-11  
**Status:** Draft  
**Kind:** Refactor

---

## Decision Record

**Decision:** Route constraints are authored in the spec markdown (J.4 table) and compiled into `RouteRecord.constraints` during build.

**Rationale (FPF-grounded):**

- **A.15 (Role-Method-Work Alignment):** The query engine is a Method. Content knowledge — including which patterns form a retrieval cluster and which constraints apply to a route — is a MethodDescription concern. Per A.15, a MethodDescription describes a Method on a carrier; the Method itself must not embed content that belongs in the description. Hard-coding IDs is the "recipe-as-evidence" anti-pattern (A.15, problem #2, CC-A15-4).
- **A.7 (Strict Distinction / Clarity Lattice):** The compiled index (MethodDescription) and the retrieval algorithm (Method) are categorically distinct. Hard-coded IDs conflate them. Per CC-A7.1, behaviour must be expressed as Method (design-time capability) and Work (run-time occurrence) — not as embedded content knowledge.
- **A.1.1 (U.BoundedContext):** The engine and the spec content are separate bounded contexts. Hard-coded IDs breach that boundary; the engine reaches into the spec's namespace without going through the compiled index interface.
- **G.11:Ext.SchedulingHeuristics (precedent):** G.11 establishes that scheduling strategies and priority heuristics "must live as policy-bound extensions, not as hidden universal rules." Our seed rules are hidden universal rules that should be policy-bound metadata instead.

**Format:** Constraints are authored as a new column in the J.4 route table (semicolon-delimited strings), parsed during compilation, and stored on `RouteRecord.constraints: string[]`. This keeps route-specific knowledge versioned alongside the route definition in the spec.

---

## Problem

`query-engine.ts` contains 7 hard-coded elements that tie the retrieval algorithm to specific FPF spec content:

| Element | Location | Hard-Coded Content |
|---------|----------|-------------------|
| Creative search seeds | L610 | `['C.17', 'C.18', 'C.19', 'B.5.2.1', 'A.0']` |
| Creative search initial nodes | L653 | `['C.17', 'C.18', 'C.19']` |
| Project alignment seeds | L621-622 | `route:project-alignment` + `['A.1.1', 'A.15', 'B.5.1', 'F.17']` |
| Role assignment seeds | L631 | `['A.1.1', 'A.2.1', 'A.2.5']` |
| Same-entity comparative seeds | L640 | `['A.6.3.CR', 'A.6.3.RT', 'E.17.ID.CR']` |
| Same-entity initial nodes | L660 | `['A.6.3.CR', 'A.6.3.RT', 'E.17.ID.CR']` |
| Project alignment constraints | L1247-1253 | Two constraint strings keyed to `route.name === 'project alignment'` |

When FPF spec IDs change, the engine code must be updated — violating the bounded context separation.

## Approach

**Approach A (selected): Semantic tags on individual patterns.**

Each pattern declares its seed participation via a `*Seeds:*` tag in its catalog row. Seed category definitions (trigger keywords, scores) are authored in a comment block at the top of the spec preface. Route constraints are authored in the J.4 table. The compiler resolves everything into typed metadata; the query engine consumes it generically.

**Alternatives considered:**

- **B: Dedicated heuristic index section (J.5 table)** — centralizes all seed config but decouples it from the patterns it references. Seed IDs can drift if patterns are renamed.
- **C: Heading blockquote metadata** — clean per-pattern, but not every pattern has a heading section, and trigger keywords still need a separate home.

## Design

### 1. Spec Format Changes

**Seed category definitions** — HTML comment block at the top of the catalog preface:

```markdown
<!-- Seed Categories:
  creative-search: creativity, creative | open-ended, open ended, search || score=64
  project-alignment: vocabulary | overloaded, across teams, across contexts || score=20, route=route:project-alignment(80)
  role-assignment-connection: role assignment | connect, relation || score=36
  same-entity-comparative: same entity, same-entity | rewrite, comparative || score=40
-->
```

Format per line: `category-name: group1-keywords | group2-keywords || score=N[, route=routeId(routeScore)]`

- Keyword groups separated by single `|` — groups are AND'd, keywords within a group are OR'd
- Parameters follow `||` (double pipe): `score=N` (seed score), `route=routeId(routeScore)` (optional route boost)

**Per-pattern seed tags** — added to the existing Keywords & Search Queries column:

```markdown
| A.0 | **Onboarding Glossary** | Stable | *Keywords:* ... *Seeds:* creative-search | ... |
```

Patterns tagged with `+initial` also serve as initial entry nodes for that category:

```markdown
*Seeds:* creative-search+initial
```

**Seed tag assignments** (derived from current hard-coded values):

| Pattern | Seed Tag |
|---------|----------|
| C.17 | `creative-search+initial` |
| C.18 | `creative-search+initial` |
| C.19 | `creative-search+initial` |
| B.5.2.1 | `creative-search` |
| A.0 | `creative-search` |
| A.1.1 | `project-alignment, role-assignment-connection` |
| A.15 | `project-alignment` |
| B.5.1 | `project-alignment` |
| F.17 | `project-alignment` |
| A.2.1 | `role-assignment-connection` |
| A.2.5 | `role-assignment-connection` |
| A.6.3.CR | `same-entity-comparative+initial` |
| A.6.3.RT | `same-entity-comparative+initial` |
| E.17.ID.CR | `same-entity-comparative+initial` |

**Route constraints** — new column in the J.4 table:

```markdown
| Route | First Honest Burden | Route Surfaces | Description | Next Owners | Reroutes | Constraints |
```

The `project alignment` row gets:

```
Add F.11 and F.9 only when method/work vocabulary itself must be aligned across contexts.; Land on F.17 early rather than escalating directly into heavier governance or assurance surfaces.
```

Semicolon-delimited constraint strings. Other routes get an empty cell.

### 2. Type Changes

**`PatternRecord`** — new field:

```typescript
export interface PatternRecord {
  // ... existing fields
  seedCategories: string[];  // e.g. ['creative-search', 'creative-search+initial']
}
```

**`RouteRecord`** — new field:

```typescript
export interface RouteRecord {
  // ... existing fields
  constraints: string[];  // e.g. ['Add F.11 and F.9 only when...']
}
```

**New type** — seed category definition:

```typescript
export interface SeedCategory {
  name: string;                    // 'creative-search'
  triggerKeywords: string[][];     // [['creativity','creative'], ['open-ended','open ended','search']]
  score: number;                   // 64
  routeId?: string;                // 'route:project-alignment'
  routeScore?: number;             // 80
}
```

`triggerKeywords` is an array of arrays: inner arrays are OR-groups, outer array is AND'd.

**Compiled indexes** — new entry:

```typescript
export interface CompiledIndexes {
  // ... existing indexes
  seedCategoryIndex: Record<string, SeedCategory>;
}
```

### 3. Compiler Changes

**`parseSeedCategories()`** — new function. Scans preface for `<!-- Seed Categories: ... -->` comment block. Parses each line into a `SeedCategory` record. Builds `seedCategoryIndex`.

**`parseCatalogMetadata()`** — extend Keywords column parsing. After extracting `*Keywords:*` and `*Queries:*`, extract `*Seeds:*` values. Split by comma, trim. Store on `PatternMeta.seedCategories`.

**`parseJ4Routes()`** — extend to parse the new `Constraints` column (index 6). Split by `;`, trim. Store on `RouteRecord.constraints`.

**`buildPatternGraph()`** — propagate `seedCategories` from `PatternMeta` to `PatternRecord`.

**`buildIndexes()`** — build `seedCategoryIndex` from parsed `SeedCategory` records.

### 4. Query Engine Changes

**`addHeuristicSeeds()`** — replace entire body:

```
for each [name, category] in snapshot.indexes.seedCategoryIndex:
  if all trigger keyword groups match normalizedQuestion:
    // Find patterns tagged with this category
    for each pattern in snapshot.patternGraph.nodes:
      if pattern.seedCategories includes name (with or without +initial):
        addCandidate(pattern.id, category.score, name, 'lexical')
    // Boost route if configured
    if category.routeId:
      addCandidate(category.routeId, category.routeScore, 'burden:' + name, 'route_expansion')
```

No hard-coded IDs. The engine iterates compiled metadata.

**`heuristicInitialNodeIds()`** — replace entire body:

```
for each [name, category] in snapshot.indexes.seedCategoryIndex:
  if all trigger keyword groups match normalizedQuestion:
    return patterns tagged with name+initial, filtered to those existing in snapshot
return []
```

**`buildRouteAnswer()`** — replace the `route.name === 'project alignment'` block:

```
if (route.constraints && route.constraints.length > 0) {
  constraints.push(...route.constraints);
}
```

Generic — works for any route with constraints, not just "project alignment".

### 5. Performance Note

The `addHeuristicSeeds` replacement iterates all patterns for each matching category. With ~100 patterns and ~4 categories, this is ~400 string checks in the worst case — negligible. If the category count grows significantly, a pre-built reverse index (`seedCategoryToPatternIds: Record<string, string[]>`) can be added to `CompiledIndexes`.

### 6. Testing

- All existing tests must pass (no behavioral change for current spec content)
- Add unit tests for:
  - `parseSeedCategories()` — correct parsing of comment block format
  - Seed tag extraction from Keywords column
  - Route constraint parsing from J.4 table
  - `addHeuristicSeeds()` — same candidates produced from metadata as from old hard-coded logic
  - `heuristicInitialNodeIds()` — same initial nodes produced
  - `buildRouteAnswer()` — constraints applied from metadata

### 7. Acceptance Criteria (from issue)

- [x] No hard-coded FPF node IDs in `query-engine.ts` heuristic methods
- [x] No route-name string checks in `buildRouteAnswer()`
- [x] Seed rules driven from compiled metadata (spec-authored seed categories + pattern tags)
- [x] Route constraints stored in `RouteRecord` metadata (compiled from J.4 table)
- [x] All existing tests pass

---

## Research Context

This refactoring aligns with two emerging directions in agentic retrieval systems:

- **Vectorless Agentic Memory** ([emergentmind.com/research/ebe5632a7b43ad0e116c0d13](https://www.emergentmind.com/research/ebe5632a7b43ad0e116c0d13)) — the shift from flat vector similarity to graph-based, structured memory with decoupled semantic/temporal/causal layers. Moving from hard-coded keyword-to-ID mappings (a flat heuristic) to compiled metadata on the graph itself mirrors this transition: each pattern declares its semantic role, and the engine traverses the structure rather than maintaining a parallel lookup table.

- **Reasoning-based RAG** ([emergentmind.com/research/9bbc4fdcf49f6866c7be51c0](https://www.emergentmind.com/research/9bbc4fdcf49f6866c7be51c0)) — the move from "retrieve then concatenate" to agentic, multi-step inference. The key concern — **reasoning misalignment** (when inference diverges from retrieved context constraints) — maps directly to the FPF "recipe-as-evidence" anti-pattern. When the engine carries content assumptions that drift from the compiled index, retrieval quality degrades silently. Metadata-driven seeds eliminate this drift vector.

---

## FPF Grounding

| Principle | Relevance |
|-----------|-----------|
| A.7 (Strict Distinction) | Method (engine) and MethodDescription (compiled index) must not be conflated. Hard-coded IDs violate CC-A7.1. |
| A.15 (Role-Method-Work) | Engine embedding content knowledge is the inverse "recipe-as-evidence" anti-pattern. Content belongs in MethodDescription. |
| A.1.1 (BoundedContext) | Engine and spec content are separate bounded contexts. Compiled index is the proper interface. |
| G.11:Ext.SchedulingHeuristics | Establishes precedent: heuristics must be policy-bound extensions, not hidden universal rules. |
