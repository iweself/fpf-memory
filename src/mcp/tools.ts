import { FpfRuntime } from '../runtime/runtime.js';
import type {
  AnswerMode,
  AskFpfResult,
  BuildAudit,
  ExpandCitationsResult,
  InspectAnchorResult,
  InspectResult,
  QueryResult,
  RuntimeStatus,
  TraceResult,
} from '../runtime/types.js';
import {
  askFpfInputContract,
  askFpfOutputContract,
  expandFpfCitationsInputContract,
  expandFpfCitationsOutputContract,
  getFpfIndexStatusInputContract,
  getFpfIndexStatusOutputContract,
  inspectFpfAnchorInputContract,
  inspectFpfAnchorOutputContract,
  inspectFpfNodeInputContract,
  inspectFpfNodeOutputContract,
  queryFpfSpecInputContract,
  queryFpfSpecOutputContract,
  refreshFpfIndexInputContract,
  refreshFpfIndexOutputContract,
  traceFpfPathInputContract,
  traceFpfPathOutputContract,
  type ToolContract,
} from './tool-contracts.js';

const runtime = new FpfRuntime();
const DEFAULT_QUERY_MODE: AnswerMode = 'verbose';

export interface FpfMcpToolDefinition<Input, Output> {
  readonly name: string;
  readonly description: string;
  readonly inputContract: ToolContract<Input>;
  readonly outputContract: ToolContract<Output>;
  execute(input: Input): Promise<Output>;
}

export const refreshFpfIndexTool = defineTool<
  { force?: boolean },
  BuildAudit
>({
  name: 'refresh_fpf_index',
  description: 'Build or rebuild the local vectorless FPF index from FPF-spec.md and persist the artifact set.',
  inputContract: refreshFpfIndexInputContract,
  outputContract: refreshFpfIndexOutputContract,
  execute: async ({ force }) => runtime.refresh(force ?? false),
});

export const queryFpfSpecTool = defineTool<
  { question: string; mode?: AnswerMode; forceRefresh?: boolean; sessionId?: string },
  QueryResult
>({
  name: 'query_fpf_spec',
  description: 'Answer questions against the local vectorless FPF runtime with auditable IDs, citations, constraints, and freshness metadata.',
  inputContract: queryFpfSpecInputContract,
  outputContract: queryFpfSpecOutputContract,
  execute: async ({ question, mode, forceRefresh, sessionId }) =>
    runtime.query(question, mode ?? resolveDefaultQueryMode(), forceRefresh ?? false, sessionId),
});

export const askFpfTool = defineTool<
  { question: string; mode?: AnswerMode; forceRefresh?: boolean; sessionId?: string },
  AskFpfResult
>({
  name: 'ask_fpf',
  description: 'Return an FPF answer in markdown with grounding metadata using the local vectorless runtime.',
  inputContract: askFpfInputContract,
  outputContract: askFpfOutputContract,
  execute: async ({ question, mode, forceRefresh, sessionId }) => {
    const result = await runtime.query(
      question,
      mode ?? resolveDefaultQueryMode(),
      forceRefresh ?? false,
      sessionId,
    );
    return renderAskFpfResult(question, result);
  },
});

export const getFpfIndexStatusTool = defineTool<{}, RuntimeStatus>({
  name: 'get_fpf_index_status',
  description: 'Inspect whether the local FPF index exists, whether it is fresh against the current source hash, and which artifacts are present.',
  inputContract: getFpfIndexStatusInputContract,
  outputContract: getFpfIndexStatusOutputContract,
  execute: async () => runtime.status(),
});

export const inspectFpfNodeTool = defineTool<
  { selector: string; kind?: 'auto' | 'id' | 'route' | 'lexeme'; forceRefresh?: boolean },
  InspectResult
>({
  name: 'inspect_fpf_node',
  description: 'Inspect one compiled FPF node by exact ID, route name, or lexeme and return anchors plus neighboring relations.',
  inputContract: inspectFpfNodeInputContract,
  outputContract: inspectFpfNodeOutputContract,
  execute: async ({ selector, kind, forceRefresh }) =>
    runtime.inspect(selector, kind ?? 'auto', forceRefresh ?? false),
});

export const inspectFpfAnchorTool = defineTool<
  { anchorId: string; forceRefresh?: boolean },
  InspectAnchorResult
>({
  name: 'inspect_fpf_anchor',
  description: 'Inspect one compiled FPF anchor by exact anchor ID and return raw anchor text plus owning node context.',
  inputContract: inspectFpfAnchorInputContract,
  outputContract: inspectFpfAnchorOutputContract,
  execute: async ({ anchorId, forceRefresh }) =>
    runtime.inspectAnchor(anchorId, forceRefresh ?? false),
});

export const expandFpfCitationsTool = defineTool<
  { citationIds: string[]; forceRefresh?: boolean },
  ExpandCitationsResult
>({
  name: 'expand_fpf_citations',
  description: 'Expand multiple exact citation IDs into raw anchor text plus owning node context without adding new semantics.',
  inputContract: expandFpfCitationsInputContract,
  outputContract: expandFpfCitationsOutputContract,
  execute: async ({ citationIds, forceRefresh }) =>
    runtime.expandCitations(citationIds, forceRefresh ?? false),
});

export const traceFpfPathTool = defineTool<
  { question: string; mode?: AnswerMode; forceRefresh?: boolean; sessionId?: string },
  TraceResult
>({
  name: 'trace_fpf_path',
  description: 'Return the deterministic retrieval trace showing normalization, candidate scores, graph expansion, and selected slices.',
  inputContract: traceFpfPathInputContract,
  outputContract: traceFpfPathOutputContract,
  execute: async ({ question, mode, forceRefresh, sessionId }) =>
    runtime.trace(question, mode ?? 'compact', forceRefresh ?? false, sessionId),
});

export const fpfMcpTools = [
  refreshFpfIndexTool,
  getFpfIndexStatusTool,
  queryFpfSpecTool,
  traceFpfPathTool,
  inspectFpfNodeTool,
  inspectFpfAnchorTool,
  expandFpfCitationsTool,
  askFpfTool,
] as const;

export const fpfMcpToolMap = Object.fromEntries(
  fpfMcpTools.map((tool) => [tool.name, tool]),
) as Record<string, FpfMcpToolDefinition<unknown, unknown>>;

export function resolveDefaultQueryMode(env: NodeJS.ProcessEnv = process.env): AnswerMode {
  const mode = env.FPF_QUERY_DEFAULT_MODE?.trim().toLowerCase();
  return mode === 'compact' || mode === 'proof' || mode === 'verbose'
    ? (mode as AnswerMode)
    : DEFAULT_QUERY_MODE;
}

function defineTool<Input, Output>(
  definition: FpfMcpToolDefinition<Input, Output>,
): FpfMcpToolDefinition<Input, Output> {
  return definition;
}

function renderAskFpfResult(question: string, result: QueryResult): AskFpfResult {
  return {
    question,
    mode: result.mode,
    markdown: renderMarkdown(result),
    ids: result.ids,
    citations: result.citations,
    constraints: result.constraints,
    gaps: result.gaps,
    confidence: result.confidence,
    status: result.status,
    snapshot: result.snapshot,
    groundingChain: result.groundingChain,
  };
}

function renderMarkdown(result: QueryResult): string {
  const lines: string[] = ['## Result', '', result.answer];

  if (result.constraints.length > 0) {
    lines.push('', '## Constraints', '', ...result.constraints.map((constraint) => `- ${constraint}`));
  }

  if (result.gaps.length > 0) {
    lines.push('', '## Gaps', '', ...result.gaps.map((gap) => `- ${gap}`));
  }

  lines.push(
    '',
    '## Grounding',
    '',
    `- Mode: \`${result.mode}\``,
    `- Status: \`${result.status}\``,
    `- Confidence: ${result.confidence}`,
    `- IDs: ${formatCodeList(result.ids)}`,
    `- Citations: ${formatCodeList(result.citations)}`,
    `- Snapshot: \`${result.snapshot.sourceHash}\` at \`${result.snapshot.builtAt}\``,
  );

  if (result.groundingChain && result.groundingChain.length > 0) {
    lines.push('', '## Grounding Chain', '', ...result.groundingChain.map((item) => `- ${item}`));
  }

  return lines.join('\n');
}

function formatCodeList(items: string[]): string {
  return items.length > 0 ? items.map((item) => `\`${item}\``).join(', ') : 'none';
}
