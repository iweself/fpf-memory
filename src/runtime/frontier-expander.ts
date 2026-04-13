import {
  selectBestAnchors,
} from './compiler.js';
import {
  normalizeForLookup,
  unique,
} from './text.js';
import type {
  AnchorRef,
  FollowedReference,
  FrontierCandidate,
  GraphExpansion,
  RelationEdge,
  RetrievalHop,
  SectionRole,
  Snapshot,
  TraceCandidate,
} from './types.js';

import {
  MAX_HOPS,
  MAX_SELECTED_ANCHORS,
} from './constants.js';

export interface GroundingResult {
  selectedNodeIds: string[];
  selectedAnchorIds: string[];
  retrievalHops: RetrievalHop[];
  followedReferences: FollowedReference[];
  graphExpansions: GraphExpansion[];
  sufficient: boolean;
}

interface FrontierWorkItem extends FrontierCandidate {
  priority: number;
  relation?: RelationEdge;
}

export function expandGrounding(
  question: string,
  candidates: TraceCandidate[],
  initialNodeIds: string[],
  initialAnchorIds: string[],
  frontierCandidates: FrontierCandidate[],
  frontierKeys: Set<string>,
  snapshot: Snapshot,
): GroundingResult {
  const graphExpansions: GraphExpansion[] = [];
  const selectedNodeIds = unique(initialNodeIds);
  const selectedAnchorIds = unique(initialAnchorIds).slice(0, MAX_SELECTED_ANCHORS);
  const retrievalHops: RetrievalHop[] = [];
  const followedReferences: FollowedReference[] = [];
  const candidateScoreById = new Map(
    candidates.map((candidate) => [candidate.nodeId, candidate.score] as const),
  );

  let sufficient = isGroundingSufficient(question, selectedNodeIds, selectedAnchorIds, snapshot);

  for (let iteration = 1; iteration <= MAX_HOPS && !sufficient; iteration += 1) {
    const missingRoles = getMissingRoles(question, selectedAnchorIds, snapshot);
    const frontier = buildFrontier(
      question,
      selectedNodeIds,
      selectedAnchorIds,
      candidateScoreById,
      missingRoles,
      frontierCandidates,
      frontierKeys,
      snapshot,
    );
    const picked = frontier[0];
    if (!picked) {
      break;
    }

    const addedNodeIds = selectedNodeIds.includes(picked.targetId) ? [] : [picked.targetId];
    const addedAnchorIds = anchorIdsForNode(question, picked.targetId, missingRoles, snapshot).filter(
      (anchorId) => !selectedAnchorIds.includes(anchorId),
    );

    if (addedNodeIds.length === 0 && addedAnchorIds.length === 0) {
      continue;
    }

    selectedNodeIds.push(...addedNodeIds);
    selectedAnchorIds.push(...addedAnchorIds);

    if (picked.relation) {
      graphExpansions.push({
        from: picked.relation.from,
        relation: picked.relation.relation,
        to: picked.relation.to,
        reason: picked.reason,
      });
      if (picked.relation.relation === 'explicit_reference') {
        followedReferences.push({
          from: picked.relation.from,
          to: picked.relation.to,
          relation: picked.relation.relation,
          source: picked.relation.source,
        });
      }
    }

    const boundedAnchorIds = unique(selectedAnchorIds).slice(0, MAX_SELECTED_ANCHORS);
    sufficient = isGroundingSufficient(
      question,
      unique(selectedNodeIds),
      boundedAnchorIds,
      snapshot,
    );
    retrievalHops.push({
      iteration,
      reason: picked.reason,
      addedNodeIds,
      addedAnchorIds,
      sufficientAfter: sufficient,
    });
  }

  const finalAnchorIds = unique(selectedAnchorIds).slice(0, MAX_SELECTED_ANCHORS);
  return {
    selectedNodeIds: unique(selectedNodeIds),
    selectedAnchorIds: finalAnchorIds,
    retrievalHops,
    followedReferences,
    graphExpansions,
    sufficient,
  };
}

function buildFrontier(
  question: string,
  selectedNodeIds: string[],
  _selectedAnchorIds: string[],
  candidateScoreById: Map<string, number>,
  missingRoles: SectionRole[],
  frontierCandidates: FrontierCandidate[],
  frontierKeys: Set<string>,
  snapshot: Snapshot,
): FrontierWorkItem[] {
  const selected = new Set(selectedNodeIds);
  const queue = new Map<string, FrontierWorkItem>();

  const register = (
    item: FrontierWorkItem,
    appendFrontier = true,
  ): void => {
    const node = snapshot.compiledNodes[item.targetId];
    if (!node || selected.has(item.targetId)) {
      return;
    }

    const existing = queue.get(item.targetId);
    if (
      existing &&
      (existing.priority < item.priority ||
        (existing.priority === item.priority && existing.score >= item.score))
    ) {
      return;
    }
    queue.set(item.targetId, item);

    if (appendFrontier) {
      const frontierKey = `${item.targetId}:${item.origin}:${item.reason}`;
      if (!frontierKeys.has(frontierKey)) {
        frontierKeys.add(frontierKey);
        frontierCandidates.push({
          targetId: item.targetId,
          kind: item.kind,
          reason: item.reason,
          score: item.score,
          origin: item.origin,
        });
      }
    }
  };

  for (const nodeId of selectedNodeIds) {
    const sourceNode = snapshot.compiledNodes[nodeId];
    if (!sourceNode) {
      continue;
    }
    for (const edge of sourceNode.neighborEdges) {
      const target = snapshot.compiledNodes[edge.to];
      if (!target || target.kind === 'lexeme') {
        continue;
      }

      const baseScore = candidateScoreById.get(edge.to) ?? 0;
      if (edge.relation === 'explicit_reference') {
        register({
          targetId: edge.to,
          kind: target.kind,
          reason: `explicit reference from ${edge.from}`,
          score: 90 + baseScore,
          origin: 'reference_follow',
          priority: 1,
          relation: edge,
        });
        continue;
      }

      if (
        ['route_hint', 'route_step', 'landing_on', 'current_route_surface', 'typical_next_owner'].includes(
          edge.relation,
        )
      ) {
        register({
          targetId: edge.to,
          kind: target.kind,
          reason: `route expansion via ${edge.relation}`,
          score: 70 + baseScore,
          origin: 'route_expansion',
          priority: 2,
          relation: edge,
        });
        continue;
      }

      if (
        [
          'builds_on',
          'prerequisite_for',
          'used_by',
          'coordinates_with',
          'constrains',
          'refines',
          'enables',
          'informs',
          'constitutes',
          'constrained_by',
          'interacts_with',
        ].includes(edge.relation)
      ) {
        const coverage = anchorIdsForNode(question, edge.to, missingRoles, snapshot).length;
        register({
          targetId: edge.to,
          kind: target.kind,
          reason:
            coverage > 0
              ? `role coverage via ${edge.relation}`
              : `graph neighbor via ${edge.relation}`,
          score: 50 + coverage * 4 + baseScore,
          origin: 'reference_follow',
          priority: coverage > 0 ? 3 : 5,
          relation: edge,
        });
        continue;
      }

      if (
        [
          'outline_parent',
          'outline_child',
          'outline_prev_sibling',
          'outline_next_sibling',
        ].includes(edge.relation)
      ) {
        register({
          targetId: edge.to,
          kind: target.kind,
          reason: `outline adjacency via ${edge.relation}`,
          score: 34 + baseScore,
          origin: 'adjacency',
          priority: 4,
          relation: edge,
        });
      }
    }
  }

  for (const [nodeId, score] of candidateScoreById.entries()) {
    if (selected.has(nodeId)) {
      continue;
    }
    const node = snapshot.compiledNodes[nodeId];
    if (!node || node.kind === 'lexeme') {
      continue;
    }

    const coverage = anchorIdsForNode(question, nodeId, missingRoles, snapshot).length;
    if (coverage > 0) {
      register({
        targetId: nodeId,
        kind: node.kind,
        reason: `missing role coverage (${missingRoles.join(', ')})`,
        score: score + coverage * 6,
        origin: 'lexical',
        priority: 3,
      });
    } else {
      register({
        targetId: nodeId,
        kind: node.kind,
        reason: 'lexical fallback',
        score,
        origin: 'lexical',
        priority: 6,
      });
    }
  }

  return Array.from(queue.values()).sort((left, right) => {
    if (left.priority !== right.priority) {
      return left.priority - right.priority;
    }
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return left.targetId.localeCompare(right.targetId);
  });
}

function anchorIdsForNode(
  question: string,
  nodeId: string,
  preferredRoles: SectionRole[],
  snapshot: Snapshot,
): string[] {
  const node = snapshot.compiledNodes[nodeId];
  if (!node) {
    return [];
  }

  if (node.kind === 'route') {
    const route = snapshot.routeGraph.nodes[nodeId];
    return route ? unique(route.anchorIds) : [];
  }

  if (node.kind !== 'pattern') {
    return [];
  }

  return collectAnchorsForNode(question, nodeId, preferredRoles, snapshot).map((anchor) => anchor.id);
}

function collectAnchorsForNode(
  question: string,
  nodeId: string,
  preferredRoles: SectionRole[],
  snapshot: Snapshot,
): AnchorRef[] {
  const pattern = snapshot.patternGraph.nodes[nodeId];
  if (!pattern) {
    return [];
  }

  const ranked = selectBestAnchors(question, pattern, snapshot.anchorMap);
  if (preferredRoles.length === 0) {
    return ranked.slice(0, 4);
  }

  return unique([
    ...ranked.filter((anchor) => preferredRoles.includes(anchor.role)),
    ...ranked.filter((anchor) => !preferredRoles.includes(anchor.role)),
  ]).slice(0, 4);
}

function getMissingRoles(question: string, anchorIds: string[], snapshot: Snapshot): SectionRole[] {
  const rolesPresent = new Set(
    anchorIds
      .map((anchorId) => snapshot.anchorMap[anchorId]?.role)
      .filter((role): role is SectionRole => Boolean(role)),
  );
  return requiredRolesForQuestion(question).filter((role) => !rolesPresent.has(role));
}

function requiredRolesForQuestion(question: string): SectionRole[] {
  const normalized = normalizeForLookup(question);
  const roles = new Set<SectionRole>();

  if (
    normalized.includes('connect') ||
    normalized.includes('workflow') ||
    normalized.includes('relation')
  ) {
    roles.add('relations');
  }
  if (
    normalized.includes('must') ||
    normalized.includes('shall') ||
    normalized.includes('checklist') ||
    normalized.includes('conformance')
  ) {
    roles.add('conformance');
  }
  if (normalized.includes('why') || normalized.includes('problem')) {
    roles.add('problem');
  }
  if (normalized.includes('force')) {
    roles.add('forces');
  }
  if (
    roles.size === 0 ||
    normalized.includes('what is') ||
    normalized.includes('definition') ||
    normalized.includes('use')
  ) {
    roles.add('definition');
    roles.add('solution');
  }

  return Array.from(roles);
}

function isGroundingSufficient(
  question: string,
  nodeIds: string[],
  anchorIds: string[],
  snapshot: Snapshot,
): boolean {
  if (nodeIds.length === 0 || anchorIds.length === 0) {
    return false;
  }

  const anchors = anchorIds
    .map((anchorId) => snapshot.anchorMap[anchorId])
    .filter((anchor): anchor is AnchorRef => Boolean(anchor));
  const normalized = normalizeForLookup(question);
  const patternNodeIds = nodeIds.filter((nodeId) => snapshot.patternGraph.nodes[nodeId]);
  const hasRoute = nodeIds.some((nodeId) => snapshot.routeGraph.nodes[nodeId]);
  const roleSet = new Set(anchors.map((anchor) => anchor.role));

  if (
    normalized.includes('connect') ||
    normalized.includes('workflow') ||
    normalized.includes('relation')
  ) {
    return patternNodeIds.length >= 2 && roleSet.has('relations');
  }

  if (
    normalized.includes('must') ||
    normalized.includes('shall') ||
    normalized.includes('checklist') ||
    normalized.includes('conformance')
  ) {
    return roleSet.has('conformance');
  }

  if (
    normalized.includes('route') ||
    normalized.includes('where to start') ||
    normalized.includes('first route') ||
    normalized.includes('overloaded') ||
    normalized.includes('across teams')
  ) {
    return hasRoute && patternNodeIds.length >= 3;
  }

  return roleSet.has('definition') || roleSet.has('solution');
}
