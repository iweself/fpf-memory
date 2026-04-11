import { copyFile, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resetMastraObservabilityForTests } from '../src/mastra/observability.js';
import { LmStudioSynthesizer } from '../src/runtime/lm-studio-synthesizer.js';
import { FpfRuntime } from '../src/runtime/runtime.js';

describe('LmStudioSynthesizer', () => {
  const canonicalSourcePath = resolve(process.cwd(), 'FPF-spec.md');
  let tempRoot: string;
  let sourcePath: string;
  let artifactDir: string;
  let aiTraceLogPath: string;
  let observabilityLogPath: string;

  beforeEach(async () => {
    tempRoot = await mkdtemp(resolve(tmpdir(), 'fpf-runtime-lmstudio-'));
    sourcePath = resolve(tempRoot, 'FPF-spec.md');
    artifactDir = resolve(tempRoot, 'artifacts');
    aiTraceLogPath = resolve(tempRoot, 'ai-traces.jsonl');
    observabilityLogPath = resolve(tempRoot, 'mastra-observability.json');
    await copyFile(canonicalSourcePath, sourcePath);
    await resetMastraObservabilityForTests();
  });

  afterEach(async () => {
    delete process.env.FPF_LOCAL_LLM_BASE_URL;
    delete process.env.FPF_LOCAL_LLM_MODEL;
    delete process.env.FPF_LOCAL_LLM_API_KEY;
    delete process.env.FPF_LOCAL_LLM_TIMEOUT_MS;
    delete process.env.FPF_MASTRA_OBSERVABILITY_PATH;
    delete process.env.FPF_MASTRA_OBSERVABILITY_FORMAT;
    delete process.env.FPF_MASTRA_OBSERVABILITY_INCLUDE_INTERNAL_SPANS;
    delete process.env.FPF_MASTRA_OBSERVABILITY_INCLUDE_MODEL_CHUNKS;
    delete process.env.FPF_MASTRA_OBSERVABILITY_LOG_LEVEL;
    await resetMastraObservabilityForTests();
    await rm(tempRoot, { recursive: true, force: true });
  });

  it('calls the LM Studio responses endpoint with bounded slices only', async () => {
    let requestUrl = '';
    let requestBody = '';

    const runtime = new FpfRuntime({
      sourcePath,
      artifactDir,
      synthesizer: new LmStudioSynthesizer({
        baseUrl: 'http://localhost:1234/v1',
        model: 'qwen/qwen3-coder-next',
        env: {
          FPF_AI_TRACE_LOG_PATH: aiTraceLogPath,
          FPF_MASTRA_OBSERVABILITY_PATH: observabilityLogPath,
        },
        fetchImpl: async (url, init) => {
          requestUrl = String(url);
          requestBody = String(init?.body ?? '');
          return new Response(
            JSON.stringify({
              output_text: JSON.stringify({
                answer: 'Local synthesis answer.',
                constraints: ['Use only provided bounded slices.'],
                confidence: 0.78,
                gaps: [],
                groundingChain: ['Used the bounded slice set only.'],
              }),
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        },
      }),
    });

    const result = await runtime.query('What is U.BoundedContext?', 'compact');
    const sourceText = await readFile(sourcePath, 'utf8');

    expect(result.answer).toBe('Local synthesis answer.');
    expect(result.constraints).toEqual(['Use only provided bounded slices.']);
    expect(result.confidence).toBe(0.78);
    expect(result.groundingChain).toEqual(['Used the bounded slice set only.']);

    expect(requestUrl).toBe('http://localhost:1234/v1/responses');
    expect(requestBody).toContain('"model":"qwen/qwen3-coder-next"');
    expect(requestBody).toContain('A.1.1');
    expect(requestBody).toContain('Retrieval summary:');
    expect(requestBody).toContain('Frontier:');
    expect(requestBody.length).toBeLessThan(sourceText.length / 5);

    const traceLog = await readFile(aiTraceLogPath, 'utf8');
    expect(traceLog).toContain('"phase":"request"');
    expect(traceLog).toContain('"phase":"response"');
    expect(traceLog).toContain('"question":"What is U.BoundedContext?"');

    const observabilityLog = await readFile(observabilityLogPath, 'utf8');
    expect(observabilityLog).toContain('"type": "model_generation"');
    expect(observabilityLog).toContain('"provider": "lm_studio"');
    expect(observabilityLog).toContain('"model": "qwen/qwen3-coder-next"');
  });

  it('auto-configures the local synthesizer from environment for status visibility', async () => {
    process.env.FPF_LOCAL_LLM_BASE_URL = 'http://localhost:1234/v1';
    process.env.FPF_LOCAL_LLM_MODEL = 'qwen/qwen3-coder-next';
    process.env.FPF_MASTRA_OBSERVABILITY_PATH = observabilityLogPath;

    const runtime = new FpfRuntime({
      sourcePath,
      artifactDir,
    });

    const status = await runtime.status();
    expect(status.synthesizer.configured).toBe(true);
    expect(status.synthesizer.provider).toBe('lm_studio');
    expect(status.synthesizer.model).toBe('qwen/qwen3-coder-next');
    expect(status.synthesizer.baseUrl).toBe('http://localhost:1234/v1');
    expect(status.observability.configured).toBe(true);
    expect(status.observability.filePath).toBe(observabilityLogPath);
    expect(status.observability.format).toBe('flat');
    expect(status.sessionCache.enabled).toBe(true);
  });

  it('falls back deterministically when LM Studio returns an error', async () => {
    const runtime = new FpfRuntime({
      sourcePath,
      artifactDir,
      synthesizer: new LmStudioSynthesizer({
        baseUrl: 'http://localhost:1234/v1',
        model: 'qwen/qwen3-coder-next',
        env: {
          FPF_AI_TRACE_LOG_PATH: aiTraceLogPath,
          FPF_MASTRA_OBSERVABILITY_PATH: observabilityLogPath,
        },
        fetchImpl: async () =>
          new Response('server exploded', {
            status: 500,
            headers: { 'Content-Type': 'text/plain' },
          }),
      }),
    });

    const result = await runtime.query('What is U.BoundedContext?', 'compact');
    expect(result.ids).toContain('A.1.1');
    expect(result.gaps.some((gap) => gap.includes('Local synthesis skipped'))).toBe(true);

    const traceLog = await readFile(aiTraceLogPath, 'utf8');
    expect(traceLog).toContain('"phase":"response"');
    expect(traceLog).toContain('"ok":false');

    const observabilityLog = await readFile(observabilityLogPath, 'utf8');
    expect(observabilityLog).toContain('"type": "model_generation"');
    expect(observabilityLog).toContain('"errorInfo"');
  });
});
