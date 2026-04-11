import { createTool } from '@mastra/core/tools';

import {
  expandFpfCitationsInputSchema,
  expandFpfCitationsOutputSchema,
  getFpfIndexStatusInputSchema,
  getFpfIndexStatusOutputSchema,
  inspectFpfAnchorInputSchema,
  inspectFpfAnchorOutputSchema,
  inspectFpfNodeInputSchema,
  inspectFpfNodeOutputSchema,
  queryFpfSpecInputSchema,
  queryFpfSpecOutputSchema,
  refreshFpfIndexInputSchema,
  refreshFpfIndexOutputSchema,
  traceFpfPathInputSchema,
  traceFpfPathOutputSchema,
} from '../contracts/fpf-spec-tool-contracts.js';
import { FpfRuntime } from '../../runtime/runtime.js';

const runtime = new FpfRuntime();

export const refreshFpfIndexTool = createTool({
  id: 'refresh_fpf_index',
  description:
    'Build or rebuild the local vectorless FPF index from FPF-spec.md and persist the artifact set.',
  inputSchema: refreshFpfIndexInputSchema,
  outputSchema: refreshFpfIndexOutputSchema,
  execute: async ({ force }) => runtime.refresh(force ?? false),
});

export const queryFpfSpecTool = createTool({
  id: 'query_fpf_spec',
  description:
    'Answer questions against the local vectorless FPF runtime with auditable IDs, citations, constraints, and freshness metadata.',
  inputSchema: queryFpfSpecInputSchema,
  outputSchema: queryFpfSpecOutputSchema,
  execute: async ({ question, mode, forceRefresh, sessionId }) =>
    runtime.query(question, mode ?? 'compact', forceRefresh ?? false, sessionId),
});

export const getFpfIndexStatusTool = createTool({
  id: 'get_fpf_index_status',
  description:
    'Inspect whether the local FPF index exists, whether it is fresh against the current source hash, and which artifacts are present.',
  inputSchema: getFpfIndexStatusInputSchema,
  outputSchema: getFpfIndexStatusOutputSchema,
  execute: async () => runtime.status(),
});

export const inspectFpfNodeTool = createTool({
  id: 'inspect_fpf_node',
  description:
    'Inspect one compiled FPF node by exact ID, route name, or lexeme and return anchors plus neighboring relations.',
  inputSchema: inspectFpfNodeInputSchema,
  outputSchema: inspectFpfNodeOutputSchema,
  execute: async ({ selector, kind, forceRefresh }) =>
    runtime.inspect(selector, kind ?? 'auto', forceRefresh ?? false),
});

export const inspectFpfAnchorTool = createTool({
  id: 'inspect_fpf_anchor',
  description:
    'Inspect one compiled FPF anchor by exact anchor ID and return raw anchor text plus owning node context.',
  inputSchema: inspectFpfAnchorInputSchema,
  outputSchema: inspectFpfAnchorOutputSchema,
  execute: async ({ anchorId, forceRefresh }) =>
    runtime.inspectAnchor(anchorId, forceRefresh ?? false),
});

export const expandFpfCitationsTool = createTool({
  id: 'expand_fpf_citations',
  description:
    'Expand multiple exact citation IDs into raw anchor text plus owning node context without adding new semantics.',
  inputSchema: expandFpfCitationsInputSchema,
  outputSchema: expandFpfCitationsOutputSchema,
  execute: async ({ citationIds, forceRefresh }) =>
    runtime.expandCitations(citationIds, forceRefresh ?? false),
});

export const traceFpfPathTool = createTool({
  id: 'trace_fpf_path',
  description:
    'Return the deterministic retrieval trace showing normalization, candidate scores, graph expansion, and selected slices.',
  inputSchema: traceFpfPathInputSchema,
  outputSchema: traceFpfPathOutputSchema,
  execute: async ({ question, mode, forceRefresh, sessionId }) =>
    runtime.trace(question, mode ?? 'compact', forceRefresh ?? false, sessionId),
});

export const fpfSpecRuntimeTools = {
  refreshFpfIndexTool,
  queryFpfSpecTool,
  getFpfIndexStatusTool,
  inspectFpfNodeTool,
  inspectFpfAnchorTool,
  expandFpfCitationsTool,
  traceFpfPathTool,
};
