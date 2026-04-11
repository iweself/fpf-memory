import { readFile, writeFile } from 'node:fs/promises';

import { resolveLogPath } from '../logging/file-paths.js';

type ObservabilityFileFormat = 'flat' | 'tree' | 'normalized';
type ObservabilityLogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

const DEFAULT_LOG_FILE = 'mastra-observability.json';
const writeChains = new Map<string, Promise<void>>();

export interface RuntimeObservabilitySummary {
  configured: boolean;
  filePath: string;
  format: ObservabilityFileFormat;
  includeInternalSpans: boolean;
  logLevel: ObservabilityLogLevel;
  excludeModelChunks: boolean;
}

interface PersistedObservabilityLog {
  service: string;
  format: ObservabilityFileFormat;
  updatedAt: string;
  events: Array<Record<string, unknown>>;
}

export async function withRuntimeSpan<TResult>(options: {
  env?: NodeJS.ProcessEnv;
  type: string;
  name: string;
  input?: unknown;
  attributes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  mapOutput?: (result: TResult) => unknown;
  operation: () => Promise<TResult>;
}): Promise<TResult> {
  const env = options.env ?? process.env;
  const summary = getRuntimeObservabilitySummary(env);
  const startedAt = new Date().toISOString();

  try {
    const result = await options.operation();
    await appendObservabilityEvent(summary.filePath, summary.format, {
      type: options.type,
      name: options.name,
      startedAt,
      endedAt: new Date().toISOString(),
      input: options.input,
      attributes: options.attributes,
      metadata: options.metadata,
      output: options.mapOutput ? options.mapOutput(result) : result,
    });
    return result;
  } catch (error) {
    await appendObservabilityEvent(summary.filePath, summary.format, {
      type: options.type,
      name: options.name,
      startedAt,
      endedAt: new Date().toISOString(),
      input: options.input,
      attributes: options.attributes,
      metadata: options.metadata,
      errorInfo: {
        message: error instanceof Error ? error.message : 'Unknown observability error',
      },
    });
    throw error;
  }
}

export function getRuntimeObservabilitySummary(
  env: NodeJS.ProcessEnv = process.env,
): RuntimeObservabilitySummary {
  return {
    configured: true,
    filePath: resolveLogPath(env.FPF_MASTRA_OBSERVABILITY_PATH, DEFAULT_LOG_FILE),
    format: normalizeFormat(env.FPF_MASTRA_OBSERVABILITY_FORMAT),
    includeInternalSpans: parseBoolean(env.FPF_MASTRA_OBSERVABILITY_INCLUDE_INTERNAL_SPANS, true),
    logLevel: normalizeLogLevel(env.FPF_MASTRA_OBSERVABILITY_LOG_LEVEL),
    excludeModelChunks: !parseBoolean(env.FPF_MASTRA_OBSERVABILITY_INCLUDE_MODEL_CHUNKS, false),
  };
}

export async function resetRuntimeObservabilityForTests(): Promise<void> {
  writeChains.clear();
}

async function appendObservabilityEvent(
  filePath: string,
  format: ObservabilityFileFormat,
  event: Record<string, unknown>,
): Promise<void> {
  const current = writeChains.get(filePath) ?? Promise.resolve();
  const next = current.then(async () => {
    const document = await loadPersistedObservability(filePath, format);
    document.updatedAt = new Date().toISOString();
    document.events.push(event);
    await writeFile(filePath, JSON.stringify(document, null, 2));
  });
  writeChains.set(filePath, next.catch(() => undefined));
  await next;
}

async function loadPersistedObservability(
  filePath: string,
  format: ObservabilityFileFormat,
): Promise<PersistedObservabilityLog> {
  try {
    const existing = JSON.parse(await readFile(filePath, 'utf8')) as PersistedObservabilityLog;
    if (Array.isArray(existing.events)) {
      return existing;
    }
  } catch {
    // Fall through to initialize a new document.
  }

  return {
    service: 'fpf-spec-runtime',
    format,
    updatedAt: new Date().toISOString(),
    events: [],
  };
}

function normalizeFormat(value: string | undefined): ObservabilityFileFormat {
  switch (value?.trim().toLowerCase()) {
    case 'tree':
    case 'normalized':
      return value.trim().toLowerCase() as ObservabilityFileFormat;
    default:
      return 'flat';
  }
}

function normalizeLogLevel(value: string | undefined): ObservabilityLogLevel {
  switch (value?.trim().toLowerCase()) {
    case 'debug':
    case 'warn':
    case 'error':
    case 'fatal':
      return value.trim().toLowerCase() as ObservabilityLogLevel;
    default:
      return 'info';
  }
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }

  switch (value.trim().toLowerCase()) {
    case '1':
    case 'true':
    case 'yes':
    case 'on':
      return true;
    case '0':
    case 'false':
    case 'no':
    case 'off':
      return false;
    default:
      return fallback;
  }
}
