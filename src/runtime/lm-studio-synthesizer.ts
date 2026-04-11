import { SpanType } from '@mastra/core/observability';

import { withMastraSpan } from '../mastra/observability.js';
import type {
  AnswerSlice,
  AnswerSynthesizerInput,
  AnswerSynthesizerOutput,
  LocalAnswerSynthesizer,
  LocalAnswerSynthesizerInfo,
} from './types.js';
import { createAiTraceRecorder } from './ai-trace-log.js';

export interface LmStudioSynthesizerOptions {
  baseUrl: string;
  model: string;
  apiKey?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  env?: NodeJS.ProcessEnv;
}

interface ResponsesApiPayload {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
}

export class LmStudioSynthesizer implements LocalAnswerSynthesizer {
  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly options: LmStudioSynthesizerOptions) {
    this.endpoint = options.baseUrl.replace(/\/$/, '').endsWith('/responses')
      ? options.baseUrl.replace(/\/$/, '')
      : `${options.baseUrl.replace(/\/$/, '')}/responses`;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 20_000;
  }

  isAvailable(): boolean {
    return Boolean(this.options.baseUrl && this.options.model);
  }

  describe(): LocalAnswerSynthesizerInfo {
    return {
      provider: 'lm_studio',
      model: this.options.model,
      baseUrl: this.options.baseUrl,
    };
  }

  async synthesize(input: AnswerSynthesizerInput): Promise<AnswerSynthesizerOutput> {
    const traceRecorder = createAiTraceRecorder(this.options.env);
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(input);
    const startedAt = Date.now();
    await traceRecorder.append({
      phase: 'request',
      provider: 'lm_studio',
      endpoint: this.endpoint,
      model: this.options.model,
      question: input.question,
      mode: input.mode,
      selectedNodeIds: input.trace.selectedNodeIds,
      selectedAnchorIds: input.trace.selectedAnchorIds,
      sessionApplied: input.trace.sessionApplied,
      sessionReusedNodeIds: input.trace.sessionReusedNodeIds,
      frontierCandidates: input.trace.frontierCandidates.slice(0, 12),
      retrievalHops: input.trace.retrievalHops,
      followedReferences: input.trace.followedReferences,
      request: {
        systemPrompt,
        userPrompt,
      },
    });

    const endpointInfo = describeEndpoint(this.endpoint);
    const spanResult = await withMastraSpan({
      env: this.options.env,
      type: SpanType.MODEL_GENERATION,
      name: `local synthesis: ${this.options.model}`,
      input: {
        question: input.question,
        mode: input.mode,
        selectedNodeIds: input.trace.selectedNodeIds,
        selectedAnchorIds: input.trace.selectedAnchorIds,
        sliceIds: input.slices.slice(0, 8).map((slice) => slice.anchorId),
        sessionApplied: input.trace.sessionApplied,
        retrievalHopCount: input.trace.retrievalHops.length,
      },
      attributes: {
        model: this.options.model,
        provider: 'lm_studio',
        streaming: false,
        serverAddress: endpointInfo.serverAddress,
        serverPort: endpointInfo.serverPort,
      },
      metadata: {
        endpoint: this.endpoint,
        frontierCount: input.trace.frontierCandidates.length,
        followedReferenceCount: input.trace.followedReferences.length,
        traceStatus: input.trace.status,
      },
      mapOutput: ({ output, httpStatus, durationMs }) => ({
        answerPreview: output.answer?.slice(0, 400),
        constraintCount: output.constraints?.length ?? 0,
        confidence: output.confidence,
        gapCount: output.gaps?.length ?? 0,
        httpStatus,
        durationMs,
      }),
      operation: async () => {
        let response: Response;
        try {
          response = await this.fetchImpl(this.endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(this.options.apiKey
                ? { Authorization: `Bearer ${this.options.apiKey}` }
                : {}),
            },
            body: JSON.stringify({
              model: this.options.model,
              temperature: 0.1,
              input: [
                {
                  role: 'system',
                  content: [
                    {
                      type: 'input_text',
                      text: systemPrompt,
                    },
                  ],
                },
                {
                  role: 'user',
                  content: [
                    {
                      type: 'input_text',
                      text: userPrompt,
                    },
                  ],
                },
              ],
            }),
            signal: AbortSignal.timeout(this.timeoutMs),
          });
        } catch (error) {
          await traceRecorder.append({
            phase: 'error',
            provider: 'lm_studio',
            endpoint: this.endpoint,
            model: this.options.model,
            durationMs: Date.now() - startedAt,
            error: {
              message:
                error instanceof Error ? error.message : 'Unknown LM Studio transport error',
            },
          });
          throw error;
        }

        if (!response.ok) {
          const body = await response.text();
          await traceRecorder.append({
            phase: 'response',
            provider: 'lm_studio',
            endpoint: this.endpoint,
            model: this.options.model,
            durationMs: Date.now() - startedAt,
            httpStatus: response.status,
            ok: false,
            responseText: body,
          });
          throw new Error(
            `LM Studio synthesis failed with ${response.status}: ${body.slice(0, 300)}`,
          );
        }

        const payload = (await response.json()) as ResponsesApiPayload;
        const text = extractResponsesText(payload);
        await traceRecorder.append({
          phase: 'response',
          provider: 'lm_studio',
          endpoint: this.endpoint,
          model: this.options.model,
          durationMs: Date.now() - startedAt,
          httpStatus: response.status,
          ok: true,
          responseText: text ?? JSON.stringify(payload),
        });
        if (!text) {
          throw new Error('LM Studio synthesis returned no output text.');
        }

        return {
          output: parseSynthesisOutput(text),
          httpStatus: response.status,
          durationMs: Date.now() - startedAt,
        };
      },
    });

    return spanResult.output;
  }
}

export function createSynthesizerFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl?: typeof fetch,
): LocalAnswerSynthesizer | undefined {
  const baseUrl = env.FPF_LOCAL_LLM_BASE_URL?.trim();
  const model = env.FPF_LOCAL_LLM_MODEL?.trim();
  if (!baseUrl || !model) {
    return undefined;
  }

  const timeoutMs = Number(env.FPF_LOCAL_LLM_TIMEOUT_MS ?? '20000');
  return new LmStudioSynthesizer({
    baseUrl,
    model,
    apiKey: env.FPF_LOCAL_LLM_API_KEY?.trim(),
    timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 20_000,
    fetchImpl,
    env,
  });
}

function buildSystemPrompt(): string {
  return [
    'You are the local synthesis layer for a vectorless FPF retrieval runtime.',
    'Use only the provided nodes, citations, and bounded slices.',
    'Never introduce IDs, relations, constraints, or claims that are not present in the provided material.',
    'If the provided slices are insufficient, keep the deterministic answer and report the gap instead of inventing content.',
    'Return strict JSON only with keys: answer, constraints, confidence, gaps, groundingChain.',
    'confidence must be a number from 0 to 1.',
  ].join(' ');
}

function buildUserPrompt(input: AnswerSynthesizerInput): string {
  const slices = input.slices
    .slice(0, 8)
    .map((slice) => formatSlice(slice))
    .join('\n\n');
  const nodeSummary = input.nodes
    .slice(0, 8)
    .map((node) => `${node.id} | ${node.kind} | ${node.title}`)
    .join('\n');

  return [
    `Question: ${input.question}`,
    `Mode: ${input.mode}`,
    `Deterministic answer:\n${input.deterministicResult.answer}`,
    `Deterministic IDs: ${input.deterministicResult.ids.join(', ') || 'none'}`,
    `Deterministic citations: ${input.deterministicResult.citations.join(', ') || 'none'}`,
    'Retrieval summary:',
    buildTraceSummary(input),
    'Candidate nodes:',
    nodeSummary || 'none',
    'Bounded slices:',
    slices || 'none',
    'Return strict JSON only.',
  ].join('\n\n');
}

function formatSlice(slice: AnswerSlice): string {
  return [
    `[${slice.anchorId}] ${slice.heading} (${slice.role}) lines ${slice.lineStart}-${slice.lineEnd}`,
    slice.text.slice(0, 1_800),
  ].join('\n');
}

function describeEndpoint(endpoint: string): {
  serverAddress?: string;
  serverPort?: number;
} {
  try {
    const url = new URL(endpoint);
    return {
      serverAddress: url.hostname || undefined,
      serverPort: url.port ? Number(url.port) : undefined,
    };
  } catch {
    return {};
  }
}

function buildTraceSummary(input: AnswerSynthesizerInput): string {
  const frontier = input.trace.frontierCandidates
    .slice(0, 10)
    .map(
      (candidate) =>
        `${candidate.origin} -> ${candidate.targetId} (${candidate.score}) ${candidate.reason}`,
    )
    .join('\n');
  const hops = input.trace.retrievalHops
    .slice(0, 6)
    .map(
      (hop) =>
        `hop ${hop.iteration}: ${hop.reason}; nodes=${hop.addedNodeIds.join(', ') || 'none'}; anchors=${hop.addedAnchorIds.join(', ') || 'none'}; sufficientAfter=${String(hop.sufficientAfter)}`,
    )
    .join('\n');
  const followedReferences = input.trace.followedReferences
    .slice(0, 6)
    .map((edge) => `${edge.from} -> ${edge.to} (${edge.source})`)
    .join('\n');

  return [
    `Status: ${input.trace.status}; sufficient=${String(input.trace.sufficient)}`,
    `Session applied: ${String(input.trace.sessionApplied)}; reused=${input.trace.sessionReusedNodeIds.join(', ') || 'none'}; material=${String(input.trace.sessionMateriallyChanged)}`,
    `Frontier:\n${frontier || 'none'}`,
    `Hops:\n${hops || 'none'}`,
    `Followed references:\n${followedReferences || 'none'}`,
  ].join('\n\n');
}

function extractResponsesText(payload: ResponsesApiPayload): string | undefined {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (typeof content.text === 'string' && content.text.trim()) {
        return content.text.trim();
      }
    }
  }

  return undefined;
}

function parseSynthesisOutput(text: string): AnswerSynthesizerOutput {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  const jsonCandidate = extractJsonObject(cleaned);
  if (!jsonCandidate) {
    return { answer: cleaned };
  }

  try {
    const parsed = JSON.parse(jsonCandidate) as {
      answer?: unknown;
      constraints?: unknown;
      confidence?: unknown;
      gaps?: unknown;
      groundingChain?: unknown;
    };

    return {
      answer: typeof parsed.answer === 'string' ? parsed.answer : undefined,
      constraints: Array.isArray(parsed.constraints)
        ? parsed.constraints.filter((item): item is string => typeof item === 'string')
        : undefined,
      confidence:
        typeof parsed.confidence === 'number' && parsed.confidence >= 0 && parsed.confidence <= 1
          ? parsed.confidence
          : undefined,
      gaps: Array.isArray(parsed.gaps)
        ? parsed.gaps.filter((item): item is string => typeof item === 'string')
        : undefined,
      groundingChain: Array.isArray(parsed.groundingChain)
        ? parsed.groundingChain.filter((item): item is string => typeof item === 'string')
        : undefined,
    };
  } catch {
    return { answer: cleaned };
  }
}

function extractJsonObject(text: string): string | undefined {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) {
    return undefined;
  }
  return text.slice(start, end + 1);
}
