import {
  findLexemeMatches,
} from './compiler.js';
import {
  extractIds,
  normalizeForLookup,
} from './text.js';
import type {
  Snapshot,
} from './types.js';

export interface DetectedSignals {
  ids: string[];
  lexemes: string[];
  routeNames: string[];
  familyTerms: string[];
  statusTerms: string[];
}

export interface NormalizedQuery {
  question: string;
  normalizedQuestion: string;
  detected: DetectedSignals;
  matchedLexemeIds: string[];
}

export function normalizeQuery(
  question: string,
  snapshot: Snapshot,
): NormalizedQuery {
  const normalizedQuestion = normalizeForLookup(question);

  const detectedIds = extractIds(question);
  const matchedLexemeIds = findLexemeMatches(question, snapshot.lexicon);
  const matchedRouteNames = Object.values(snapshot.routeGraph.nodes)
    .filter((route) => normalizedQuestion.includes(normalizeForLookup(route.name)))
    .map((route) => route.name);
  const familyTerms = Object.keys(snapshot.indexes.familyIndex).filter((key) =>
    normalizedQuestion.includes(key),
  );
  const statusTerms = ['draft', 'stable', 'stub', 'transitional'].filter((term) =>
    normalizedQuestion.includes(term),
  );

  return {
    question,
    normalizedQuestion,
    detected: {
      ids: detectedIds,
      lexemes: matchedLexemeIds
        .map((lexemeId) => snapshot.lexicon[lexemeId]?.canonical)
        .filter((value): value is string => Boolean(value)),
      routeNames: matchedRouteNames,
      familyTerms,
      statusTerms,
    },
    matchedLexemeIds,
  };
}
