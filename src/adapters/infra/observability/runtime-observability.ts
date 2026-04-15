import {
  SpanType,
  type FeedbackEvent,
  type LogEvent,
  type MetricEvent,
  type ScoreEvent,
  type SpanTypeMap,
  type TracingEvent,
} from '@mastra/core/observability';
import { Observability, TestExporter } from '@mastra/observability';

import { resolveLogPath } from '../../../logging/file-paths.js';
import type { ObservabilityConfig } from '../config/types.js';

const DEFAULT_LOG_FILE = 'mastra-observability.json';

interface PersistedExporterOptions {
  filePath: string;
  format: ObservabilityConfig['format'];
}

export interface RuntimeObservabilitySummary {
  configured: boolean;
  filePath: string;
  format: ObservabilityConfig['format'];
  includeInternalSpans: boolean;
  logLevel: ObservabilityConfig['logLevel'];
  excludeModelChunks: boolean;
}

interface RuntimeObservabilityHandle extends RuntimeObservabilitySummary {
  observability: Observability;
}

class PersistedTestExporter extends TestExporter {
  readonly name = 'persisted-test-exporter';
  private writeChain = Promise.resolve();

  constructor(private readonly options: PersistedExporterOptions) {
    super({
      jsonIndent: 2,
      logLevel: 'error',
      logMetricsOnFlush: false,
      storeLogs: true,
      validateLifecycle: true,
    });
  }

  protected override async _exportTracingEvent(event: TracingEvent): Promise<void> {
    await super._exportTracingEvent(event);
    await this.persist();
  }

  override async onLogEvent(event: LogEvent): Promise<void> {
    await super.onLogEvent(event);
    await this.persist();
  }

  override async onMetricEvent(event: MetricEvent): Promise<void> {
    await super.onMetricEvent(event);
    await this.persist();
  }

  override async onScoreEvent(event: ScoreEvent): Promise<void> {
    await super.onScoreEvent(event);
    await this.persist();
  }

  override async onFeedbackEvent(event: FeedbackEvent): Promise<void> {
    await super.onFeedbackEvent(event);
    await this.persist();
  }

  override async flush(): Promise<void> {
    await super.flush();
    await this.persist();
  }

  override async shutdown(): Promise<void> {
    await this.flush();
    await super.shutdown();
  }

  private async persist(): Promise<void> {
    const writeOperation = this.writeChain.then(() =>
      this.writeToFile(this.options.filePath, {
        indent: 2,
        includeEvents: true,
        includeStats: true,
        format: this.options.format,
      }),
    );
    this.writeChain = writeOperation.catch(() => undefined);
    await writeOperation;
  }
}

let cachedHandle: RuntimeObservabilityHandle | undefined;
let cachedKey: string | undefined;

export function getRuntimeObservability(
  config: ObservabilityConfig,
): RuntimeObservabilityHandle {
  const summary = resolveRuntimeObservabilitySummary(config);
  const cacheKey = JSON.stringify(summary);

  if (cachedHandle && cachedKey === cacheKey) {
    return cachedHandle;
  }

  if (cachedHandle) {
    void cachedHandle.observability.shutdown().catch(() => undefined);
  }

  const exporter = new PersistedTestExporter({
    filePath: summary.filePath,
    format: summary.format,
  });
  const observability = new Observability({
    configs: {
      default: {
        serviceName: config.serviceName,
        exporters: [exporter],
        includeInternalSpans: summary.includeInternalSpans,
        excludeSpanTypes: summary.excludeModelChunks ? [SpanType.MODEL_CHUNK] : [],
        logging: {
          enabled: true,
          level: summary.logLevel,
        },
        serializationOptions: {
          maxStringLength: 8_000,
          maxDepth: 8,
          maxArrayLength: 24,
          maxObjectKeys: 40,
        },
      },
    },
  });

  cachedHandle = {
    ...summary,
    observability,
  };
  cachedKey = cacheKey;
  return cachedHandle;
}

export function getRuntimeObservabilitySummary(
  config: ObservabilityConfig,
): RuntimeObservabilitySummary {
  return resolveRuntimeObservabilitySummary(config);
}

export async function withRuntimeSpan<TType extends SpanType, TResult>(options: {
  observabilityConfig?: ObservabilityConfig;
  type: TType;
  name: string;
  input?: unknown;
  attributes?: SpanTypeMap[TType];
  metadata?: Record<string, unknown>;
  mapOutput?: (result: TResult) => unknown;
  operation: () => Promise<TResult>;
}): Promise<TResult> {
  if (!options.observabilityConfig) {
    return options.operation();
  }

  const handle = getRuntimeObservability(options.observabilityConfig);
  const instance = handle.observability.getDefaultInstance();
  if (!instance) {
    return options.operation();
  }

  const span = instance.startSpan({
    type: options.type,
    name: options.name,
    input: options.input,
    attributes: options.attributes,
    metadata: options.metadata,
  });

  try {
    const result = await options.operation();
    span.end({
      output: options.mapOutput ? options.mapOutput(result) : result,
    });
    return result;
  } catch (error) {
    span.error({
      error: toError(error),
      endSpan: true,
      metadata: options.metadata,
    });
    throw error;
  } finally {
    await instance.flush();
  }
}

export async function resetRuntimeObservabilityForTests(): Promise<void> {
  await cachedHandle?.observability.shutdown().catch(() => undefined);
  cachedHandle = undefined;
  cachedKey = undefined;
}

function resolveRuntimeObservabilitySummary(
  config: ObservabilityConfig,
): RuntimeObservabilitySummary {
  return {
    configured: true,
    filePath: resolveLogPath(config.filePath, DEFAULT_LOG_FILE),
    format: config.format,
    includeInternalSpans: config.includeInternalSpans,
    logLevel: config.logLevel,
    excludeModelChunks: config.excludeModelChunks,
  };
}

function toError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }
  return new Error(typeof value === 'string' ? value : 'Unknown observability error');
}
