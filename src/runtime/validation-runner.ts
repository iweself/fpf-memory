import { unique } from './text.js';
import type {
  BuildValidation,
  CompiledNode,
  IndexMapNode,
  LexiconEntry,
  PatternRecord,
  RelationEdge,
  RouteRecord,
} from './types.js';

export function buildValidation(
  compiledNodes: Record<string, CompiledNode>,
  patternNodes: Record<string, PatternRecord>,
  routeNodes: Record<string, RouteRecord>,
  lexicon: Record<string, LexiconEntry>,
  indexMap: { roots: string[]; nodes: Record<string, IndexMapNode> },
  relationGraph: RelationEdge[],
): BuildValidation {
  const duplicateIds = findDuplicateIds([
    ...Object.keys(compiledNodes),
    ...Object.keys(indexMap.nodes),
  ]);
  const unresolvedReferences = unique(
    relationGraph
      .map((edge) => edge.to)
      .filter((target) => !compiledNodes[target]),
  );
  const missingRequiredFields = Object.values(patternNodes).reduce((count, pattern) => {
    const requiredFields = [
      pattern.title,
      pattern.status,
      pattern.dependenciesRaw,
      pattern.searchableText,
    ];
    return count + requiredFields.filter((value) => !value).length;
  }, 0);
  const brokenRoutes = Object.values(routeNodes)
    .filter(
      (route) =>
        route.orderedIds.length === 0 &&
        route.routeSurfaces.length === 0 &&
        route.nextOwners.length === 0,
    )
    .map((route) => route.id);

  return {
    parsedSections: Object.keys(indexMap.nodes).length,
    parsedPatterns: Object.keys(patternNodes).length,
    parsedRoutes: Object.keys(routeNodes).length,
    parsedLexiconEntries: Object.keys(lexicon).length,
    indexMapNodes: Object.keys(indexMap.nodes).length,
    missingRequiredFields,
    unresolvedReferences,
    duplicateIds,
    brokenRoutes,
  };
}

function findDuplicateIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      duplicates.add(id);
    } else {
      seen.add(id);
    }
  }
  return Array.from(duplicates);
}
