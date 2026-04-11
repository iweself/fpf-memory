import * as EffectJsonSchema from 'effect/JSONSchema';
import * as ParseResult from 'effect/ParseResult';
import * as EffectSchema from 'effect/Schema';

import type {
  AnchorRef,
  AnswerMode,
  AnswerStatus,
  AskFpfResult,
  BuildAudit,
  CompiledNode,
  ExpandCitationsResult,
  FrontierOrigin,
  InspectAnchorResult,
  InspectNeighbor,
  InspectResult,
  QueryResult,
  RuntimeStatus,
  TraceResult,
} from '../runtime/types.js';

type JsonSchema = {
  readonly [key: string]: unknown;
  readonly type?: unknown;
};

export interface ToolContract<Value> {
  readonly schema: unknown;
  readonly jsonSchema: JsonSchema;
  validate(value: unknown): ValidationResult<Value>;
}

export type ValidationResult<Value> =
  | { success: true; value: Value }
  | { success: false; error: string };

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

const askFpfResultContract = EffectSchema.Struct({
  question: EffectSchema.String,
  mode: answerModeContract,
  markdown: EffectSchema.String,
  ids: EffectSchema.Array(EffectSchema.String),
  citations: EffectSchema.Array(EffectSchema.String),
  constraints: EffectSchema.Array(EffectSchema.String),
  gaps: EffectSchema.Array(EffectSchema.String),
  confidence: EffectSchema.Number,
  status: queryStatusContract,
  snapshot: snapshotWithRebuildContract,
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
    apiStyle: EffectSchema.optional(EffectSchema.Literal('responses', 'lmstudio_chat')),
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

function defineToolContract<Value>(
  schema: unknown,
  jsonSchemaOverride?: JsonSchema,
): ToolContract<Value> {
  const typedSchema = schema as EffectSchema.Schema<Value, unknown, never>;
  const decodeUnknownEither = EffectSchema.decodeUnknownEither(typedSchema);

  return {
    schema: typedSchema,
    jsonSchema: jsonSchemaOverride ?? (EffectJsonSchema.make(typedSchema) as unknown as JsonSchema),
    validate(value) {
      const result = decodeUnknownEither(value);
      return result._tag === 'Right'
        ? { success: true, value: result.right as Value }
        : {
            success: false,
            error: ParseResult.TreeFormatter.formatErrorSync(result.left),
          };
    },
  };
}

export const refreshFpfIndexInputContract = defineToolContract<{
  force?: boolean;
}>(
  EffectSchema.Struct({
    force: EffectSchema.optional(EffectSchema.Boolean),
  }),
);
export const refreshFpfIndexOutputContract = defineToolContract<BuildAudit>(buildAuditContract);

export const queryFpfSpecInputContract = defineToolContract<{
  question: string;
  mode?: AnswerMode;
  forceRefresh?: boolean;
  sessionId?: string;
}>(
  EffectSchema.Struct({
    question: EffectSchema.NonEmptyString,
    mode: EffectSchema.optional(answerModeContract),
    forceRefresh: EffectSchema.optional(EffectSchema.Boolean),
    sessionId: EffectSchema.optional(EffectSchema.NonEmptyString),
  }),
);
export const queryFpfSpecOutputContract = defineToolContract<QueryResult>(queryResultContract);

export const askFpfInputContract = defineToolContract<{
  question: string;
  mode?: AnswerMode;
  forceRefresh?: boolean;
  sessionId?: string;
}>(
  EffectSchema.Struct({
    question: EffectSchema.NonEmptyString,
    mode: EffectSchema.optional(answerModeContract),
    forceRefresh: EffectSchema.optional(EffectSchema.Boolean),
    sessionId: EffectSchema.optional(EffectSchema.NonEmptyString),
  }),
);
export const askFpfOutputContract = defineToolContract<AskFpfResult>(askFpfResultContract);

export const getFpfIndexStatusInputContract = defineToolContract<{}>(
  EffectSchema.Struct({}),
  {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    properties: {},
    additionalProperties: false,
  },
);
export const getFpfIndexStatusOutputContract =
  defineToolContract<RuntimeStatus>(runtimeStatusContract);

export const inspectFpfNodeInputContract = defineToolContract<{
  selector: string;
  kind?: 'auto' | 'id' | 'route' | 'lexeme';
  forceRefresh?: boolean;
}>(
  EffectSchema.Struct({
    selector: EffectSchema.NonEmptyString,
    kind: EffectSchema.optional(EffectSchema.Literal('auto', 'id', 'route', 'lexeme')),
    forceRefresh: EffectSchema.optional(EffectSchema.Boolean),
  }),
);
export const inspectFpfNodeOutputContract = defineToolContract<InspectResult>(inspectResultContract);

export const inspectFpfAnchorInputContract = defineToolContract<{
  anchorId: string;
  forceRefresh?: boolean;
}>(
  EffectSchema.Struct({
    anchorId: EffectSchema.NonEmptyString,
    forceRefresh: EffectSchema.optional(EffectSchema.Boolean),
  }),
);
export const inspectFpfAnchorOutputContract =
  defineToolContract<InspectAnchorResult>(inspectAnchorResultContract);

export const expandFpfCitationsInputContract = defineToolContract<{
  citationIds: string[];
  forceRefresh?: boolean;
}>(
  EffectSchema.Struct({
    citationIds: EffectSchema.NonEmptyArray(EffectSchema.NonEmptyString),
    forceRefresh: EffectSchema.optional(EffectSchema.Boolean),
  }),
);
export const expandFpfCitationsOutputContract =
  defineToolContract<ExpandCitationsResult>(expandCitationsResultContract);

export const traceFpfPathInputContract = defineToolContract<{
  question: string;
  mode?: AnswerMode;
  forceRefresh?: boolean;
  sessionId?: string;
}>(
  EffectSchema.Struct({
    question: EffectSchema.NonEmptyString,
    mode: EffectSchema.optional(answerModeContract),
    forceRefresh: EffectSchema.optional(EffectSchema.Boolean),
    sessionId: EffectSchema.optional(EffectSchema.NonEmptyString),
  }),
);
export const traceFpfPathOutputContract = defineToolContract<TraceResult>(traceResultContract);

export type _ContractExportCoverage =
  | AnchorRef
  | AnswerStatus
  | CompiledNode
  | FrontierOrigin
  | InspectNeighbor;
