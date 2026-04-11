import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { FpfRuntime } from '../../runtime/runtime.js';

const relationEdgeSchema = z.object({
  from: z.string(),
  relation: z.string(),
  to: z.string(),
});

const anchorSchema = z.object({
  id: z.string(),
  nodeId: z.string().optional(),
  heading: z.string(),
  lineStart: z.number(),
  lineEnd: z.number(),
  path: z.array(z.string()),
  text: z.string(),
  plainText: z.string(),
  role: z.enum([
    'definition',
    'solution',
    'relations',
    'conformance',
    'problem',
    'forces',
    'route_surface',
    'other',
  ]),
});

const compiledNodeSchema = z.object({
  id: z.string(),
  kind: z.enum(['pattern', 'route', 'lexeme']),
  title: z.string(),
  status: z.string().optional(),
  part: z.string().optional(),
  cluster: z.string().optional(),
  aliases: z.array(z.string()),
  anchorIds: z.array(z.string()),
  neighborEdges: z.array(
    z.object({
      from: z.string(),
      relation: z.string(),
      to: z.string(),
      source: z.string(),
    }),
  ),
  searchableText: z.string(),
  details: z.any(),
});

const queryResultSchema = z.object({
  mode: z.enum(['compact', 'verbose', 'proof']),
  question: z.string(),
  answer: z.string(),
  ids: z.array(z.string()),
  relations: z.array(relationEdgeSchema),
  constraints: z.array(z.string()),
  citations: z.array(z.string()),
  confidence: z.number(),
  gaps: z.array(z.string()),
  snapshot: z.object({
    sourceHash: z.string(),
    builtAt: z.string(),
    rebuilt: z.boolean(),
  }),
  status: z.enum([
    'ok',
    'not_found',
    'ambiguous',
    'unsupported',
    'stale_snapshot_prevented',
  ]),
  groundingChain: z.array(z.string()).optional(),
});

const buildAuditSchema = z.object({
  sourcePath: z.string(),
  sourceHash: z.string(),
  previousSourceHash: z.string().optional(),
  builtAt: z.string(),
  rebuilt: z.boolean(),
  reason: z.enum([
    'forced',
    'missing_snapshot',
    'source_hash_changed',
    'snapshot_current',
  ]),
  validation: z.object({
    parsedSections: z.number(),
    parsedPatterns: z.number(),
    parsedRoutes: z.number(),
    parsedLexiconEntries: z.number(),
    indexMapNodes: z.number(),
    missingRequiredFields: z.number(),
    unresolvedReferences: z.array(z.string()),
    duplicateIds: z.array(z.string()),
    brokenRoutes: z.array(z.string()),
  }),
  compiler: z.object({
    mode: z.literal('local_vectorless'),
    compiledNodes: z.number(),
    patternNodes: z.number(),
    routeNodes: z.number(),
    lexiconEntries: z.number(),
    indexMapNodes: z.number(),
    anchorCount: z.number(),
  }),
  artifacts: z.record(z.string(), z.string()),
});

const runtimeStatusSchema = z.object({
  sourcePath: z.string(),
  sourceHash: z.string().optional(),
  builtAt: z.string().optional(),
  snapshotExists: z.boolean(),
  currentSourceHash: z.string(),
  fresh: z.boolean(),
  compilerMode: z.literal('local_vectorless'),
  artifacts: z.record(z.string(), z.boolean()),
  synthesizer: z.object({
    configured: z.boolean(),
    provider: z.string().optional(),
    model: z.string().optional(),
    baseUrl: z.string().optional(),
  }),
  observability: z.object({
    configured: z.boolean(),
    filePath: z.string(),
    format: z.enum(['flat', 'tree', 'normalized']),
    includeInternalSpans: z.boolean(),
    logLevel: z.enum(['debug', 'info', 'warn', 'error', 'fatal']),
    excludeModelChunks: z.boolean(),
  }),
  sessionCache: z.object({
    enabled: z.boolean(),
    maxSessions: z.number(),
    activeSessions: z.number(),
  }),
});

const traceResultSchema = z.object({
  mode: z.enum(['compact', 'verbose', 'proof']),
  question: z.string(),
  normalizedQuestion: z.string(),
  detected: z.object({
    ids: z.array(z.string()),
    lexemes: z.array(z.string()),
    routeNames: z.array(z.string()),
    familyTerms: z.array(z.string()),
    statusTerms: z.array(z.string()),
  }),
  candidateScores: z.array(
    z.object({
      nodeId: z.string(),
      kind: z.enum(['pattern', 'route', 'lexeme']),
      score: z.number(),
      reasons: z.array(z.string()),
    }),
  ),
  frontierCandidates: z.array(
    z.object({
      targetId: z.string(),
      kind: z.enum(['pattern', 'route', 'lexeme']),
      reason: z.string(),
      score: z.number(),
      origin: z.enum([
        'exact_match',
        'reference_follow',
        'route_expansion',
        'adjacency',
        'lexical',
        'session_context',
      ]),
    }),
  ),
  graphExpansions: z.array(
    z.object({
      from: z.string(),
      relation: z.string(),
      to: z.string(),
      reason: z.string(),
    }),
  ),
  selectedNodeIds: z.array(z.string()),
  selectedAnchorIds: z.array(z.string()),
  excludedNodeIds: z.array(z.string()),
  followedReferences: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      relation: z.string(),
      source: z.string(),
    }),
  ),
  retrievalHops: z.array(
    z.object({
      iteration: z.number(),
      reason: z.string(),
      addedNodeIds: z.array(z.string()),
      addedAnchorIds: z.array(z.string()),
      sufficientAfter: z.boolean(),
    }),
  ),
  sessionApplied: z.boolean(),
  sessionReusedNodeIds: z.array(z.string()),
  sessionMateriallyChanged: z.boolean(),
  sufficient: z.boolean(),
  status: z.enum([
    'ok',
    'not_found',
    'ambiguous',
    'unsupported',
    'stale_snapshot_prevented',
  ]),
  snapshot: z.object({
    sourceHash: z.string(),
    builtAt: z.string(),
    rebuilt: z.boolean(),
  }),
});

const inspectResultSchema = z.object({
  selector: z.string(),
  resolvedAs: z.enum(['id', 'route', 'lexeme', 'not_found']),
  status: z.enum(['ok', 'not_found']),
  node: compiledNodeSchema.optional(),
  anchors: z.array(anchorSchema),
  neighbors: z.array(
    z.object({
      id: z.string(),
      kind: z.enum(['pattern', 'route', 'lexeme']),
      title: z.string(),
      relation: z.string(),
    }),
  ),
  snapshot: z.object({
    sourceHash: z.string(),
    builtAt: z.string(),
  }),
});

const runtime = new FpfRuntime();

export const refreshFpfIndexTool = createTool({
  id: 'refresh_fpf_index',
  description:
    'Build or rebuild the local vectorless FPF index from FPF-spec.md and persist the artifact set.',
  inputSchema: z.object({
    force: z
      .boolean()
      .optional()
      .describe('Force a rebuild even when the stored source hash already matches.'),
  }),
  outputSchema: buildAuditSchema,
  execute: async ({ force }) => runtime.refresh(force ?? false),
});

export const queryFpfSpecTool = createTool({
  id: 'query_fpf_spec',
  description:
    'Answer questions against the local vectorless FPF runtime with auditable IDs, citations, constraints, and freshness metadata.',
  inputSchema: z.object({
    question: z.string().min(1),
    mode: z
      .enum(['compact', 'verbose', 'proof'])
      .optional()
      .describe('Answer compactly, with more support, or with explicit proof-style grounding.'),
    forceRefresh: z
      .boolean()
      .optional()
      .describe('Force a rebuild before answering.'),
    sessionId: z
      .string()
      .min(1)
      .optional()
      .describe('Optional in-memory retrieval session ID for short multi-turn continuity.'),
  }),
  outputSchema: queryResultSchema,
  execute: async ({ question, mode, forceRefresh, sessionId }) =>
    runtime.query(question, mode ?? 'compact', forceRefresh ?? false, sessionId),
});

export const getFpfIndexStatusTool = createTool({
  id: 'get_fpf_index_status',
  description:
    'Inspect whether the local FPF index exists, whether it is fresh against the current source hash, and which artifacts are present.',
  outputSchema: runtimeStatusSchema,
  execute: async () => runtime.status(),
});

export const inspectFpfNodeTool = createTool({
  id: 'inspect_fpf_node',
  description:
    'Inspect one compiled FPF node by exact ID, route name, or lexeme and return anchors plus neighboring relations.',
  inputSchema: z.object({
    selector: z.string().min(1),
    kind: z
      .enum(['auto', 'id', 'route', 'lexeme'])
      .optional()
      .describe('How to interpret the selector before falling back to auto resolution.'),
    forceRefresh: z
      .boolean()
      .optional()
      .describe('Force a rebuild before inspecting the node.'),
  }),
  outputSchema: inspectResultSchema,
  execute: async ({ selector, kind, forceRefresh }) =>
    runtime.inspect(selector, kind ?? 'auto', forceRefresh ?? false),
});

export const traceFpfPathTool = createTool({
  id: 'trace_fpf_path',
  description:
    'Return the deterministic retrieval trace showing normalization, candidate scores, graph expansion, and selected slices.',
  inputSchema: z.object({
    question: z.string().min(1),
    mode: z
      .enum(['compact', 'verbose', 'proof'])
      .optional()
      .describe('Trace under the same answer mode that would be used for query output.'),
    forceRefresh: z
      .boolean()
      .optional()
      .describe('Force a rebuild before tracing.'),
    sessionId: z
      .string()
      .min(1)
      .optional()
      .describe('Optional in-memory retrieval session ID for short multi-turn continuity.'),
  }),
  outputSchema: traceResultSchema,
  execute: async ({ question, mode, forceRefresh, sessionId }) =>
    runtime.trace(question, mode ?? 'compact', forceRefresh ?? false, sessionId),
});

export const fpfSpecRuntimeTools = {
  refreshFpfIndexTool,
  queryFpfSpecTool,
  getFpfIndexStatusTool,
  inspectFpfNodeTool,
  traceFpfPathTool,
};
