import { PART_C_CLUSTER_LABELS, PART_C_LABEL } from './constants.js';
import {
  extractBacktickedTerms,
  extractIds,
  extractQuotedPhrases,
  normalizeForLookup,
  scoreOverlap,
  sentenceCandidates,
  tokenize,
  unique,
} from './text.js';
import type { AnchorRef, LexiconEntry, PatternRecord, RouteRecord, SectionRole } from './types.js';

export function isPartCDraftQuery(question: string): boolean {
  const normalized = normalizeForLookup(question);
  return normalized.includes('draft') && normalized.includes('part c');
}

export function scorePatternQuery(
  question: string,
  patterns: PatternRecord[],
): Array<{ pattern: PatternRecord; score: number; reasons: string[] }> {
  const queryTokens = tokenize(question);
  const exactIds = new Set(extractIds(question));
  const normalizedQuestion = normalizeForLookup(question);
  return patterns
    .map((pattern) => {
      let score = 0;
      const reasons: string[] = [];
      const overlap = scoreOverlap(queryTokens, pattern.searchableText);
      if (overlap > 0) {
        score += overlap;
        reasons.push(`token-overlap:${overlap}`);
      }
      if (exactIds.has(pattern.id)) {
        score += 100;
        reasons.push('exact-id');
      }
      for (const alias of pattern.aliases) {
        const normalizedAlias = normalizeForLookup(alias);
        if (normalizedAlias && normalizedQuestion.includes(normalizedAlias)) {
          const delta = normalizedAlias.includes(' ') ? 30 : 16;
          score += delta;
          reasons.push(`alias:${alias}`);
        }
      }
      if (normalizedQuestion.includes(normalizeForLookup(pattern.title))) {
        score += 30;
        reasons.push('title');
      }
      return { pattern, score, reasons };
    })
    .sort((left, right) => right.score - left.score);
}

export function scoreRouteQuery(
  question: string,
  routes: RouteRecord[],
): Array<{ route: RouteRecord; score: number; reasons: string[] }> {
  const queryTokens = tokenize(question);
  const normalizedQuestion = normalizeForLookup(question);
  return routes
    .map((route) => {
      let score = 0;
      const reasons: string[] = [];
      const overlap = scoreOverlap(queryTokens, route.searchableText);
      if (overlap > 0) {
        score += overlap;
        reasons.push(`token-overlap:${overlap}`);
      }
      if (normalizedQuestion.includes(normalizeForLookup(route.name))) {
        score += 30;
        reasons.push('route-name');
      }
      const selectorScore = scoreExplicitRouteSelector(normalizedQuestion, route);
      if (selectorScore > 0) {
        score += selectorScore;
        reasons.push('route-selector');
      }
      const adoptionScore = scoreAdoptionRouteIntent(normalizedQuestion, route);
      if (adoptionScore > 0) {
        score += adoptionScore;
        reasons.push('adoption-route-intent');
      }
      if (normalizedQuestion.includes('route')) {
        score += 5;
        reasons.push('route-word');
      }
      return { route, score, reasons };
    })
    .sort((left, right) => right.score - left.score);
}

function scoreExplicitRouteSelector(normalizedQuestion: string, route: RouteRecord): number {
  const routeId = normalizeForLookup(route.id);
  const bareId = routeId.replace(/^route:/, '');
  const underscoreId = routeId.replace(/^route:/, 'route_');
  const spacedName = normalizeForLookup(route.name);
  if (
    normalizedQuestion.includes(routeId) ||
    normalizedQuestion.includes(underscoreId) ||
    normalizedQuestion.includes(`route ${bareId}`) ||
    normalizedQuestion.includes(`route ${spacedName}`)
  ) {
    return 120;
  }
  return 0;
}

function scoreAdoptionRouteIntent(normalizedQuestion: string, route: RouteRecord): number {
  switch (route.id) {
    case 'route:project-alignment':
      return scoreProjectAlignmentIntent(normalizedQuestion);
    case 'route:boundary-burden':
      return scoreBoundaryBurdenIntent(normalizedQuestion);
    case 'route:boundary-unpacking':
      return scoreBoundaryUnpackingIntent(normalizedQuestion);
    default:
      return 0;
  }
}

function scoreProjectAlignmentIntent(normalizedQuestion: string): number {
  const projectSignals = [
    'project kickoff',
    'project lead',
    'new adopter',
    'project information system',
    'information system',
    'model my project',
    'align a project',
    'align a new project',
    'aligning a new project',
    'first shared work surface',
  ];
  if (projectSignals.some((signal) => normalizedQuestion.includes(signal))) {
    return 76;
  }
  if (
    normalizedQuestion.includes('project') &&
    (normalizedQuestion.includes('kickoff') ||
      normalizedQuestion.includes('model') ||
      normalizedQuestion.includes('align') ||
      normalizedQuestion.includes('smallest') ||
      normalizedQuestion.includes('work packet'))
  ) {
    return 64;
  }
  return 0;
}

function scoreBoundaryBurdenIntent(normalizedQuestion: string): number {
  const boundarySignals = [
    'api',
    'boundary',
    'interface',
    'contract',
    'protocol',
    'slo',
    'sla',
    'acceptance',
    'compliance',
    'ownership',
  ];
  const jobSignals = [
    'kickoff',
    'project lead',
    'route',
    'smallest',
    'work packet',
    'decision',
    'questions',
  ];
  if (
    boundarySignals.some((signal) => normalizedQuestion.includes(signal)) &&
    jobSignals.some((signal) => normalizedQuestion.includes(signal))
  ) {
    return 92;
  }
  return 0;
}

function scoreBoundaryUnpackingIntent(normalizedQuestion: string): number {
  const unpackingSignals = [
    'claim register',
    'atomic claim',
    'atomic claims',
    'decompose',
    'decomposed',
    'unpack',
    'unpacking',
    'mixed sentence',
    'mixed statements',
  ];
  return unpackingSignals.some((signal) => normalizedQuestion.includes(signal)) ? 96 : 0;
}

export function selectBestAnchors(
  question: string,
  pattern: PatternRecord,
  anchorMap: Record<string, AnchorRef>,
): AnchorRef[] {
  const queryTokens = tokenize(question);
  const ranked = pattern.sectionIds
    .map((anchorId) => anchorMap[anchorId])
    .filter((anchor): anchor is AnchorRef => Boolean(anchor))
    .map((anchor) => {
      let score = scoreOverlap(queryTokens, `${anchor.heading} ${anchor.plainText}`);
      if (anchor.role === 'definition' || anchor.role === 'solution') {
        score += 4;
      }
      if (anchor.role === 'relations') {
        score += 2;
      }
      if (anchor.role === 'conformance') {
        score += 1;
      }
      return { anchor, score };
    })
    .sort((left, right) => right.score - left.score);

  const picked: AnchorRef[] = [];
  const byRole = (role: SectionRole) => ranked.find((entry) => entry.anchor.role === role)?.anchor;
  for (const role of ['definition', 'solution', 'relations', 'conformance'] as const) {
    const anchor = byRole(role);
    if (anchor && !picked.some((item) => item.id === anchor.id)) {
      picked.push(anchor);
    }
  }
  for (const entry of ranked) {
    if (picked.some((anchor) => anchor.id === entry.anchor.id)) {
      continue;
    }
    picked.push(entry.anchor);
    if (picked.length >= 4) {
      break;
    }
  }
  return picked;
}

export function formatAnchorSentences(
  anchor: AnchorRef,
  question: string,
  maxSentences: number,
): string[] {
  const queryTokens = tokenize(question);
  const ranked = sentenceCandidates(anchor.plainText)
    .map((sentence) => ({
      sentence,
      score: scoreOverlap(queryTokens, sentence),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, maxSentences)
    .map((entry) => entry.sentence);
  return ranked.length > 0 ? ranked : sentenceCandidates(anchor.plainText).slice(0, maxSentences);
}

export function getPartCDraftsByCluster(
  patterns: Record<string, PatternRecord>,
): Record<string, PatternRecord[]> {
  const grouped: Record<string, PatternRecord[]> = {};
  for (const cluster of PART_C_CLUSTER_LABELS) {
    grouped[cluster] = [];
  }
  for (const pattern of Object.values(patterns)) {
    if (pattern.part !== PART_C_LABEL || normalizeForLookup(pattern.status) !== 'draft') {
      continue;
    }
    const cluster = pattern.cluster && grouped[pattern.cluster] ? pattern.cluster : PART_C_CLUSTER_LABELS[0];
    grouped[cluster] = [...(grouped[cluster] ?? []), pattern];
  }
  for (const key of Object.keys(grouped)) {
    grouped[key] = grouped[key].sort((left, right) => left.id.localeCompare(right.id));
  }
  return grouped;
}

export function findLexemeMatches(
  question: string,
  lexicon: Record<string, LexiconEntry>,
): string[] {
  const normalizedQuestion = normalizeForLookup(question);
  const quoted = unique([
    ...extractBacktickedTerms(question),
    ...extractQuotedPhrases(question),
  ]).map(normalizeForLookup);
  const matchedIds: string[] = [];
  for (const entry of Object.values(lexicon)) {
    const matched = entry.normalizedKeys.some(
      (key) =>
        !isLowSignalLexemeKey(key) &&
        (quoted.includes(key) || normalizedQuestion.includes(key)),
    );
    if (matched) {
      matchedIds.push(entry.id);
    }
  }
  return unique(matchedIds);
}

function isLowSignalLexemeKey(key: string): boolean {
  const normalized = normalizeForLookup(key);
  const wordish = normalized.replace(/[^a-z0-9]+/g, ' ').trim();
  return (
    normalized.length < 3 ||
    tokenize(wordish).length === 0 ||
    /^[a-z]+$/.test(wordish)
  );
}
