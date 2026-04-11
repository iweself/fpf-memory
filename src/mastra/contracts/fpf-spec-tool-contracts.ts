import { jsonSchema, type Schema as AiSchema } from 'ai';
import * as EffectJsonSchema from 'effect/JSONSchema';
import * as EffectSchema from 'effect/Schema';
import type { createTool } from '@mastra/core/tools';

type MastraSchemaLike = NonNullable<Parameters<typeof createTool>[0]['inputSchema']>;

const answerModeContract = EffectSchema.Literal('compact', 'verbose', 'proof');
const nodeKindContract = EffectSchema.Literal('pattern', 'route', 'lexeme');
const anchorRoleContract = EffectSchema.Literal(
  'definition',
  'solution',
  'relations',
  'conformance',
  'problem',
  'forces',
  'route_surface',
  'other',
);
const queryStatusContract = EffectSchema.Literal(
  'ok',
  'not_found',
  'ambiguous',
  'unsupported',
  'stale_snapshot_prevented',
);
const buildReasonContract = EffectSchema.Literal(
  'forced',
  'missing_snapshot',
  'source_hash_changed',
  'snapshot_current',
);
const observabilityFormatContract = EffectSchema.Literal('flat', 'tree', 'normalized');
const observabilityLogLevelContract = EffectSchema.Literal(
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
);
const resolvedAsContract = EffectSchema.Literal('id', 'route', 'lexeme', 'not_found');
const inspectStatusContract = EffectSchema.Literal('ok', 'not_found');
const frontierOriginContract = EffectSchema.Literal(
  'exact_match',
  'reference_follow',
  'route_expansion',
  'adjacency',
  'lexical',
  'session_context',
);
const expandedCitationStatusContract = EffectSchema.Literal('ok', 'not_found');

const relationEdgeContract = EffectSchema.Struct({
  from: EffectSchema.String,
  relation: EffectSchema.String,
  to: EffectSchema.String,
});

const inspectNeighborContract = EffectSchema.Struct({
  id: EffectSchema.String,
  kind: nodeKindContract,
  title: EffectSchema.String,
  relation: EffectSchema.String,
});

const anchorContract = EffectSchema.Struct({
  id: EffectSchema.String,
  nodeId: EffectSchema.optional(EffectSchema.String),
  heading: EffectSchema.String,
  lineStart: EffectSchema.Number,
  lineEnd: EffectSchema.Number,
  path: EffectSchema.Array(EffectSchema.String),
  text: EffectSchema.String,
  plainText: EffectSchema.String,
  role: anchorRoleContract,
});

const compiledNeighborEdgeContract = EffectSchema.Struct({
  from: EffectSchema.String,
  relation: EffectSchema.String,
  to: EffectSchema.String,
  source: EffectSchema.String,
});

const compiledNodeContract = EffectSchema.Struct({
  id: EffectSchema.String,
  kind: nodeKindContract,
  title: EffectSchema.String,
  status: EffectSchema.optional(EffectSchema.String),
  part: EffectSchema.optional(EffectSchema.String),
  cluster: EffectSchema.optional(EffectSchema.String),
  aliases: EffectSchema.Array(EffectSchema.String),
  anchorIds: EffectSchema.Array(EffectSchema.String),
  neighborEdges: EffectSchema.Array(compiledNeighborEdgeContract),
  searchableText: EffectSchema.String,
  details: EffectSchema.Unknown,
});

const snapshotWithRebuildContract = EffectSchema.Struct({
  sourceHash: EffectSchema.String,
  builtAt: EffectSchema.String,
  rebuilt: EffectSchema.Boolean,
});

const buildAuditContract = EffectSchema.Struct({
  sourcePath: EffectSchema.String,
  sourceHash: EffectSchema.String,
  previousSourceHash: EffectSchema.optional(EffectSchema.String),
  builtAt: EffectSchema.String,
  rebuilt: EffectSchema.Boolean,
  reason: buildReasonContract,
  validation: EffectSchema.Struct({
    parsedSections: EffectSchema.Number,
    parsedPatterns: EffectSchema.Number,
    parsedRoutes: EffectSchema.Number,
    parsedLexiconEntries: EffectSchema.Number,
    indexMapNodes: EffectSchema.Number,
    missingRequiredFields: EffectSchema.Number,
    unresolvedReferences: EffectSchema.Array(EffectSchema.String),
    duplicateIds: EffectSchema.Array(EffectSchema.String),
    brokenRoutes: EffectSchema.Array(EffectSchema.String),
  }),
  compiler: EffectSchema.Struct({
    mode: EffectSchema.Literal('local_vectorless'),
    compiledNodes: EffectSchema.Number,
    patternNodes: EffectSchema.Number,
    routeNodes: EffectSchema.Number,
    lexiconEntries: EffectSchema.Number,
    indexMapNodes: EffectSchema.Number,
    anchorCount: EffectSchema.Number,
  }),
  artifacts: EffectSchema.Record({
    key: EffectSchema.String,
    value: EffectSchema.String,
  }),
});

const queryResultContract = EffectSchema.Struct({
  mode: answerModeContract,
  question: EffectSchema.String,
  answer: EffectSchema.String,
  ids: EffectSchema.Array(EffectSchema.String),
  relations: EffectSchema.Array(relationEdgeContract),
  constraints: EffectSchema.Array(EffectSchema.String),
  citations: EffectSchema.Array(EffectSchema.String),
  confidence: EffectSchema.Number,
  gaps: EffectSchema.Array(EffectSchema.String),
  snapshot: snapshotWithRebuildContract,
  status: queryStatusContract,
  groundingChain: EffectSchema.optional(EffectSchema.Array(EffectSchema.String)),
});

const runtimeStatusContract = EffectSchema.Struct({
  sourcePath: EffectSchema.String,
  sourceHash: EffectSchema.optional(EffectSchema.String),
  builtAt: EffectSchema.optional(EffectSchema.String),
  snapshotExists: EffectSchema.Boolean,
  currentSourceHash: EffectSchema.String,
  fresh: EffectSchema.Boolean,
  compilerMode: EffectSchema.Literal('local_vectorless'),
  artifacts: EffectSchema.Record({
    key: EffectSchema.String,
    value: EffectSchema.Boolean,
  }),
  synthesizer: EffectSchema.Struct({
    configured: EffectSchema.Boolean,
    provider: EffectSchema.optional(EffectSchema.String),
    model: EffectSchema.optional(EffectSchema.String),
    baseUrl: EffectSchema.optional(EffectSchema.String),
  }),
  observability: EffectSchema.Struct({
    configured: EffectSchema.Boolean,
    filePath: EffectSchema.String,
    format: observabilityFormatContract,
    includeInternalSpans: EffectSchema.Boolean,
    logLevel: observabilityLogLevelContract,
    excludeModelChunks: EffectSchema.Boolean,
  }),
  sessionCache: EffectSchema.Struct({
    enabled: EffectSchema.Boolean,
    maxSessions: EffectSchema.Number,
    activeSessions: EffectSchema.Number,
  }),
});

const traceDetectedContract = EffectSchema.Struct({
  ids: EffectSchema.Array(EffectSchema.String),
  lexemes: EffectSchema.Array(EffectSchema.String),
  routeNames: EffectSchema.Array(EffectSchema.String),
  familyTerms: EffectSchema.Array(EffectSchema.String),
  statusTerms: EffectSchema.Array(EffectSchema.String),
});

const candidateScoreContract = EffectSchema.Struct({
  nodeId: EffectSchema.String,
  kind: nodeKindContract,
  score: EffectSchema.Number,
  reasons: EffectSchema.Array(EffectSchema.String),
});

const frontierCandidateContract = EffectSchema.Struct({
  targetId: EffectSchema.String,
  kind: nodeKindContract,
  reason: EffectSchema.String,
  score: EffectSchema.Number,
  origin: frontierOriginContract,
});

const graphExpansionContract = EffectSchema.Struct({
  from: EffectSchema.String,
  relation: EffectSchema.String,
  to: EffectSchema.String,
  reason: EffectSchema.String,
});

const followedReferenceContract = EffectSchema.Struct({
  from: EffectSchema.String,
  to: EffectSchema.String,
  relation: EffectSchema.String,
  source: EffectSchema.String,
});

const retrievalHopContract = EffectSchema.Struct({
  iteration: EffectSchema.Number,
  reason: EffectSchema.String,
  addedNodeIds: EffectSchema.Array(EffectSchema.String),
  addedAnchorIds: EffectSchema.Array(EffectSchema.String),
  sufficientAfter: EffectSchema.Boolean,
});

const traceResultContract = EffectSchema.Struct({
  mode: answerModeContract,
  question: EffectSchema.String,
  normalizedQuestion: EffectSchema.String,
  detected: traceDetectedContract,
  candidateScores: EffectSchema.Array(candidateScoreContract),
  frontierCandidates: EffectSchema.Array(frontierCandidateContract),
  graphExpansions: EffectSchema.Array(graphExpansionContract),
  selectedNodeIds: EffectSchema.Array(EffectSchema.String),
  selectedAnchorIds: EffectSchema.Array(EffectSchema.String),
  excludedNodeIds: EffectSchema.Array(EffectSchema.String),
  followedReferences: EffectSchema.Array(followedReferenceContract),
  retrievalHops: EffectSchema.Array(retrievalHopContract),
  sessionApplied: EffectSchema.Boolean,
  sessionReusedNodeIds: EffectSchema.Array(EffectSchema.String),
  sessionMateriallyChanged: EffectSchema.Boolean,
  sufficient: EffectSchema.Boolean,
  status: queryStatusContract,
  snapshot: snapshotWithRebuildContract,
});

const snapshotContract = EffectSchema.Struct({
  sourceHash: EffectSchema.String,
  builtAt: EffectSchema.String,
});

const inspectResultContract = EffectSchema.Struct({
  selector: EffectSchema.String,
  resolvedAs: resolvedAsContract,
  status: inspectStatusContract,
  node: EffectSchema.optional(compiledNodeContract),
  anchors: EffectSchema.Array(anchorContract),
  neighbors: EffectSchema.Array(inspectNeighborContract),
  snapshot: snapshotContract,
});

const inspectAnchorResultContract = EffectSchema.Struct({
  anchorId: EffectSchema.String,
  status: inspectStatusContract,
  anchor: EffectSchema.optional(anchorContract),
  ownerNode: EffectSchema.optional(compiledNodeContract),
  neighbors: EffectSchema.Array(inspectNeighborContract),
  snapshot: snapshotContract,
});

const expandedCitationContract = EffectSchema.Struct({
  citationId: EffectSchema.String,
  status: expandedCitationStatusContract,
  anchor: EffectSchema.optional(anchorContract),
  ownerNode: EffectSchema.optional(compiledNodeContract),
  neighbors: EffectSchema.Array(inspectNeighborContract),
});

const expandCitationsResultContract = EffectSchema.Struct({
  citationIds: EffectSchema.Array(EffectSchema.String),
  items: EffectSchema.Array(expandedCitationContract),
  snapshot: snapshotContract,
});

function toMastraSchema<Value>(
  contract: EffectSchema.Schema<Value>,
): MastraSchemaLike {
  const decodeUnknown = EffectSchema.decodeUnknownEither(contract);

  return jsonSchema(EffectJsonSchema.make(contract), {
    validate: async (value) => {
      const result = decodeUnknown(value);
      return result._tag === 'Right'
        ? { success: true, value: result.right }
        : { success: false, error: new Error(result.left.message) };
    },
  }) as unknown as AiSchema<Value> as MastraSchemaLike;
}

export const refreshFpfIndexInputSchema = toMastraSchema(
  EffectSchema.Struct({
    force: EffectSchema.optional(EffectSchema.Boolean),
  }),
);
export const refreshFpfIndexOutputSchema = toMastraSchema(buildAuditContract);

export const queryFpfSpecInputSchema = toMastraSchema(
  EffectSchema.Struct({
    question: EffectSchema.NonEmptyString,
    mode: EffectSchema.optional(answerModeContract),
    forceRefresh: EffectSchema.optional(EffectSchema.Boolean),
    sessionId: EffectSchema.optional(EffectSchema.NonEmptyString),
  }),
);
export const queryFpfSpecOutputSchema = toMastraSchema(queryResultContract);

export const getFpfIndexStatusInputSchema = toMastraSchema(EffectSchema.Struct({}));
export const getFpfIndexStatusOutputSchema = toMastraSchema(runtimeStatusContract);

export const inspectFpfNodeInputSchema = toMastraSchema(
  EffectSchema.Struct({
    selector: EffectSchema.NonEmptyString,
    kind: EffectSchema.optional(EffectSchema.Literal('auto', 'id', 'route', 'lexeme')),
    forceRefresh: EffectSchema.optional(EffectSchema.Boolean),
  }),
);
export const inspectFpfNodeOutputSchema = toMastraSchema(inspectResultContract);

export const inspectFpfAnchorInputSchema = toMastraSchema(
  EffectSchema.Struct({
    anchorId: EffectSchema.NonEmptyString,
    forceRefresh: EffectSchema.optional(EffectSchema.Boolean),
  }),
);
export const inspectFpfAnchorOutputSchema = toMastraSchema(inspectAnchorResultContract);

export const expandFpfCitationsInputSchema = toMastraSchema(
  EffectSchema.Struct({
    citationIds: EffectSchema.NonEmptyArray(EffectSchema.NonEmptyString),
    forceRefresh: EffectSchema.optional(EffectSchema.Boolean),
  }),
);
export const expandFpfCitationsOutputSchema = toMastraSchema(expandCitationsResultContract);

export const traceFpfPathInputSchema = toMastraSchema(
  EffectSchema.Struct({
    question: EffectSchema.NonEmptyString,
    mode: EffectSchema.optional(answerModeContract),
    forceRefresh: EffectSchema.optional(EffectSchema.Boolean),
    sessionId: EffectSchema.optional(EffectSchema.NonEmptyString),
  }),
);
export const traceFpfPathOutputSchema = toMastraSchema(traceResultContract);
