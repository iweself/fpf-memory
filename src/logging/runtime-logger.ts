import { appendFileSync } from 'node:fs';

import { resolveLogPath } from './file-paths.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface RuntimeLogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

let cachedLogger: RuntimeLogger | undefined;
let cachedKey: string | undefined;

export function getRuntimeLogger(env: NodeJS.ProcessEnv = process.env): RuntimeLogger {
  const filePath = resolveLogPath(env.FPF_MASTRA_LOG_PATH, 'mastra.log');
  const level = normalizeLogLevel(env.FPF_MASTRA_LOG_LEVEL);
  const cacheKey = `${filePath}:${level}`;

  if (cachedLogger && cachedKey === cacheKey) {
    return cachedLogger;
  }

  cachedLogger = createLogger(filePath, level);
  cachedKey = cacheKey;
  return cachedLogger;
}

function createLogger(filePath: string, minimumLevel: LogLevel): RuntimeLogger {
  const write = (level: LogLevel, msg: string, context?: Record<string, unknown>): void => {
    if (levelPriority(level) < levelPriority(minimumLevel)) {
      return;
    }

    appendFileSync(
      filePath,
      `${JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        msg,
        service: 'fpf-spec-runtime',
        logFile: filePath,
        ...(context ?? {}),
      })}\n`,
    );
  };

  return {
    debug(message, context) {
      write('debug', message, context);
    },
    info(message, context) {
      write('info', message, context);
    },
    warn(message, context) {
      write('warn', message, context);
    },
    error(message, context) {
      write('error', message, context);
    },
  };
}

function normalizeLogLevel(value: string | undefined): LogLevel {
  switch (value?.trim().toLowerCase()) {
    case 'debug':
    case 'warn':
    case 'error':
      return value.trim().toLowerCase() as LogLevel;
    default:
      return 'info';
  }
}

function levelPriority(level: LogLevel): number {
  switch (level) {
    case 'debug':
      return 10;
    case 'info':
      return 20;
    case 'warn':
      return 30;
    case 'error':
      return 40;
  }
}
