/**
 * compiler.ts — SnapshotAssembler orchestrator.
 *
 * Delegates to four focused stage modules:
 *   1. source-parser.ts   (SourceParser)
 *   2. graph-compiler.ts  (GraphCompiler)
 *   3. index-projector.ts (IndexProjector)
 *   4. validation-runner.ts (ValidationRunner)
 *
 * This file wires the stages together and assembles the final Snapshot.
 * The public `compileFpfSource()` API is unchanged.
 */

import {
  buildExplicitReferenceRelations,
  buildLexiconRelations,
  buildOutlineRelations,
  buildPatternGraph,
  buildRouteGraph,
  uniqueRelations,
} from './graph-compiler.js';
import {
  buildCompiledNodes,
  buildIndexes,
  buildIndexMap,
  buildLexicon,
} from './index-projector.js';
import { parseSource } from './source-parser.js';
import { buildValidation } from './validation-runner.js';
import type {
  AnchorRef,
  IndexMapNode,
  LexiconEntry,
  Snapshot,
} from './types.js';

export interface CompilerOutput {
  snapshot: Snapshot;
  projections: {
    indexMap: {
      roots: string[];
      nodes: Record<string, IndexMapNode>;
    };
    patternGraph: Snapshot['patternGraph'];
    routeGraph: Snapshot['routeGraph'];
    lexicon: Record<string, LexiconEntry>;
    anchorMap: Record<string, AnchorRef>;
  };
}

export function compileFpfSource(params: {
  sourcePath: string;
  sourceHash: string;
  builtAt: string;
  sourceText: string;
}): CompilerOutput {
  // Stage 1: SourceParser — markdown text → SourceIR
  const ir = parseSource(params.sourceText);

  // Stage 2: GraphCompiler — SourceIR → pattern/route/relation graphs
  const patternGraph = buildPatternGraph(ir);
  const routeGraph = buildRouteGraph(ir);
  const outlineRelations = buildOutlineRelations(patternGraph.nodes);
  const explicitReferenceRelations = buildExplicitReferenceRelations(
    ir.sections,
    patternGraph.nodes,
    routeGraph.nodes,
  );
  const relationGraph = uniqueRelations([
    ...patternGraph.relations,
    ...routeGraph.relations,
    ...outlineRelations,
    ...explicitReferenceRelations,
  ]);

  // Stage 3: IndexProjector — SourceIR + graphs → lexicon, index map, compiled nodes, indexes
  const lexicon = buildLexicon(patternGraph.nodes, routeGraph.nodes, ir.anchorMap);
  const lexiconRelations = buildLexiconRelations(lexicon);
  const allRelations = uniqueRelations([...relationGraph, ...lexiconRelations]);
  const indexMap = buildIndexMap(ir, patternGraph.nodes, routeGraph.nodes);
  const compiledNodes = buildCompiledNodes(
    patternGraph.nodes,
    routeGraph.nodes,
    lexicon,
    allRelations,
  );
  const indexes = buildIndexes(compiledNodes, patternGraph.nodes, routeGraph.nodes, lexicon);

  // Stage 4: ValidationRunner — snapshot candidate → validation findings
  const validation = buildValidation(
    compiledNodes,
    patternGraph.nodes,
    routeGraph.nodes,
    lexicon,
    indexMap,
    allRelations,
  );

  // Stage 5: SnapshotAssembler — typed intermediate artifacts → versioned snapshot
  const snapshot: Snapshot = {
    sourcePath: params.sourcePath,
    sourceHash: params.sourceHash,
    builtAt: params.builtAt,
    compilerMode: 'local_vectorless',
    indexRoots: indexMap.roots,
    indexMap: indexMap.nodes,
    anchorMap: ir.anchorMap,
    patternGraph: {
      nodes: patternGraph.nodes,
      relations: patternGraph.relations,
    },
    routeGraph: {
      nodes: routeGraph.nodes,
      relations: routeGraph.relations,
    },
    lexicon,
    compiledNodes,
    relationGraph: allRelations,
    indexes,
    validation,
  };

  return {
    snapshot,
    projections: {
      indexMap,
      patternGraph: snapshot.patternGraph,
      routeGraph: snapshot.routeGraph,
      lexicon,
      anchorMap: ir.anchorMap,
    },
  };
}

// Re-export query helpers for backwards compatibility with query-engine.ts
export {
  findLexemeMatches,
  formatAnchorSentences,
  getPartCDraftsByCluster,
  isPartCDraftQuery,
  scorePatternQuery,
  scoreRouteQuery,
  selectBestAnchors,
} from './query-helpers.js';
