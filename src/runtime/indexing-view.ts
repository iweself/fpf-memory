import { createHash } from 'node:crypto';
import type {
  ChangeFamily,
  IndexingView,
  IndexingViewEntry,
  IndexingViewRoute,
  RefreshClassification,
  RefreshSentinel,
  Snapshot,
} from './types.js';

export function buildIndexingView(snapshot: Snapshot): IndexingView {
  const patterns: Record<string, IndexingViewEntry> = {};
  for (const [id, pattern] of Object.entries(snapshot.patternGraph.nodes)) {
    patterns[id] = {
      id,
      kind: 'pattern',
      title: pattern.title,
      status: pattern.status,
      type: pattern.type,
      normativity: pattern.normativity,
      part: pattern.part,
      cluster: pattern.cluster,
      aliases: [...pattern.aliases].sort(),
      anchorIds: [...pattern.sectionIds].sort(),
      relationEdges: pattern.relations
        .map((r) => ({ from: r.from, relation: r.relation, to: r.to }))
        .sort((a, b) => `${a.from}:${a.relation}:${a.to}`.localeCompare(`${b.from}:${b.relation}:${b.to}`)),
    };
  }

  const routes: Record<string, IndexingViewRoute> = {};
  for (const [id, route] of Object.entries(snapshot.routeGraph.nodes)) {
    routes[id] = {
      id,
      name: route.name,
      orderedIds: [...route.orderedIds],
      optionalIds: [...route.optionalIds],
      landingIds: [...route.landingIds],
      routeSurfaces: [...route.routeSurfaces],
      constraints: route.firstHonestBurden ? [route.firstHonestBurden] : [],
    };
  }

  const anchorIds = Object.keys(snapshot.anchorMap).sort();
  const lexiconCanonicals = Object.keys(snapshot.lexicon).sort();
  const lexiconFingerprints: Record<string, { normalizedKeys: string[]; linkedNodeIds: string[] }> = {};
  for (const [id, entry] of Object.entries(snapshot.lexicon)) {
    lexiconFingerprints[id] = {
      normalizedKeys: [...entry.normalizedKeys].sort(),
      linkedNodeIds: [...entry.linkedNodeIds].sort(),
    };
  }

  const sortedPatterns = Object.fromEntries(Object.entries(patterns).sort(([a], [b]) => a.localeCompare(b)));
  const sortedRoutes = Object.fromEntries(Object.entries(routes).sort(([a], [b]) => a.localeCompare(b)));
  const sortedLexiconFingerprints = Object.fromEntries(
    Object.entries(lexiconFingerprints).sort(([a], [b]) => a.localeCompare(b)),
  );
  const spineContent = JSON.stringify({ patterns: sortedPatterns, routes: sortedRoutes, anchorIds, lexiconCanonicals, lexiconFingerprints: sortedLexiconFingerprints });
  const edition = `sha256:${createHash('sha256').update(spineContent).digest('hex').slice(0, 16)}`;

  return {
    edition,
    sourceHash: snapshot.sourceHash,
    builtAt: snapshot.builtAt,
    patterns,
    routes,
    anchorIds,
    lexiconCanonicals,
  };
}

export function classifyChange(
  previous: IndexingView,
  current: IndexingView,
): RefreshClassification {
  const sentinels = runRefreshSentinels(previous, current);

  const prevPatternIds = new Set(Object.keys(previous.patterns));
  const currPatternIds = new Set(Object.keys(current.patterns));
  const prevRouteIds = new Set(Object.keys(previous.routes));
  const currRouteIds = new Set(Object.keys(current.routes));

  const prevAllIds = new Set([...prevPatternIds, ...prevRouteIds]);
  const currAllIds = new Set([...currPatternIds, ...currRouteIds]);

  const addedIds = [...currAllIds].filter((id) => !prevAllIds.has(id));
  const removedIds = [...prevAllIds].filter((id) => !currAllIds.has(id));
  const changedIds: string[] = [];

  for (const id of currPatternIds) {
    if (prevPatternIds.has(id) && !entryEqual(previous.patterns[id], current.patterns[id])) {
      changedIds.push(id);
    }
  }
  for (const id of currRouteIds) {
    if (prevRouteIds.has(id) && !routeEqual(previous.routes[id], current.routes[id])) {
      changedIds.push(id);
    }
  }

  if (previous.edition === current.edition) {
    return { changeFamily: 'no_change', sentinels, addedIds, removedIds, changedIds };
  }

  const changeFamily = inferChangeFamily(previous, current, addedIds, removedIds, changedIds);
  return { changeFamily, sentinels, addedIds, removedIds, changedIds };
}

function inferChangeFamily(
  previous: IndexingView,
  current: IndexingView,
  addedIds: string[],
  removedIds: string[],
  changedIds: string[],
): ChangeFamily {
  if (addedIds.length > 0 || removedIds.length > 0) {
    return 'described_entity_retargeting';
  }

  if (changedIds.length === 0) {
    // No pattern/route ID changes but edition differs — must be anchor or lexicon change
    return 'viewing_change';
  }

  const hasSemanticChange = changedIds.some((id) => {
    const prev = previous.patterns[id];
    const curr = current.patterns[id];
    if (!prev || !curr) {
      const prevRoute = previous.routes[id];
      const currRoute = current.routes[id];
      if (prevRoute && currRoute) {
        return (
          prevRoute.name !== currRoute.name ||
          JSON.stringify(prevRoute.orderedIds) !== JSON.stringify(currRoute.orderedIds) ||
          JSON.stringify(prevRoute.landingIds) !== JSON.stringify(currRoute.landingIds) ||
          JSON.stringify(prevRoute.optionalIds) !== JSON.stringify(currRoute.optionalIds) ||
          JSON.stringify(prevRoute.routeSurfaces) !== JSON.stringify(currRoute.routeSurfaces) ||
          JSON.stringify(prevRoute.constraints) !== JSON.stringify(currRoute.constraints)
        );
      }
      return true;
    }
    return (
      prev.title !== curr.title ||
      prev.status !== curr.status ||
      prev.type !== curr.type ||
      prev.normativity !== curr.normativity ||
      JSON.stringify(prev.relationEdges) !== JSON.stringify(curr.relationEdges)
    );
  });

  if (hasSemanticChange) {
    return 'editioned_semantic_change';
  }

  const hasSlotChange = changedIds.some((id) => {
    const prev = previous.patterns[id];
    const curr = current.patterns[id];
    if (!prev || !curr) {
      return false;
    }
    return (
      prev.part !== curr.part ||
      prev.cluster !== curr.cluster ||
      JSON.stringify(prev.aliases) !== JSON.stringify(curr.aliases)
    );
  });

  if (hasSlotChange) {
    return 'slot_explicitness_change';
  }

  return 'viewing_change';
}

function runRefreshSentinels(
  previous: IndexingView,
  current: IndexingView,
): RefreshSentinel[] {
  const sentinels: RefreshSentinel[] = [];

  const prevPatternIds = new Set(Object.keys(previous.patterns));
  const currPatternIds = new Set(Object.keys(current.patterns));
  const missingIds = [...prevPatternIds].filter((id) => !currPatternIds.has(id));
  sentinels.push({
    name: 'id_continuity',
    passed: missingIds.length === 0,
    detail: missingIds.length > 0 ? truncateDetail(`Removed pattern IDs: ${missingIds.join(', ')}`) : undefined,
  });

  const prevAliases = new Set(
    Object.values(previous.patterns).flatMap((p) => p.aliases),
  );
  const currAliases = new Set(
    Object.values(current.patterns).flatMap((p) => p.aliases),
  );
  const droppedAliases = [...prevAliases].filter((a) => !currAliases.has(a));
  sentinels.push({
    name: 'alias_coverage',
    passed: droppedAliases.length === 0,
    detail: droppedAliases.length > 0 ? truncateDetail(`Dropped aliases: ${droppedAliases.join(', ')}`) : undefined,
  });

  const prevAnchorSet = new Set(previous.anchorIds);
  const currAnchorSet = new Set(current.anchorIds);
  const missingAnchors = [...prevAnchorSet].filter((a) => !currAnchorSet.has(a));
  sentinels.push({
    name: 'anchor_continuity',
    passed: missingAnchors.length === 0,
    detail: missingAnchors.length > 0 ? `Missing anchors: ${missingAnchors.slice(0, 10).join(', ')}` : undefined,
  });

  const prevRouteIds = new Set(Object.keys(previous.routes));
  const currRouteIds = new Set(Object.keys(current.routes));
  const missingRoutes = [...prevRouteIds].filter((id) => !currRouteIds.has(id));
  sentinels.push({
    name: 'route_closure',
    passed: missingRoutes.length === 0,
    detail: missingRoutes.length > 0 ? truncateDetail(`Missing routes: ${missingRoutes.join(', ')}`) : undefined,
  });

  const allRelationTargets = new Set<string>();
  for (const pattern of Object.values(current.patterns)) {
    for (const edge of pattern.relationEdges) {
      allRelationTargets.add(edge.to);
    }
  }
  const danglingRefs = [...allRelationTargets].filter(
    (id) => !currPatternIds.has(id) && !currRouteIds.has(id),
  );
  sentinels.push({
    name: 'no_dangling_references',
    passed: danglingRefs.length === 0,
    detail: danglingRefs.length > 0 ? `Dangling references: ${danglingRefs.slice(0, 10).join(', ')}` : undefined,
  });

  return sentinels;
}

const MAX_DETAIL_LENGTH = 500;
function truncateDetail(detail: string): string {
  if (detail.length <= MAX_DETAIL_LENGTH) {
    return detail;
  }
  return `${detail.slice(0, MAX_DETAIL_LENGTH)}… (truncated)`;
}

function entryEqual(
  a: IndexingViewEntry | undefined,
  b: IndexingViewEntry | undefined,
): boolean {
  if (!a || !b) {
    return a === b;
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

function routeEqual(
  a: IndexingViewRoute | undefined,
  b: IndexingViewRoute | undefined,
): boolean {
  if (!a || !b) {
    return a === b;
  }
  return JSON.stringify(a) === JSON.stringify(b);
}
