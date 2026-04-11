import { PinoLogger } from '@mastra/loggers';
import { FileTransport } from '@mastra/loggers/file';

import { resolveLogPath } from '../logging/file-paths.js';

let cachedLogger: PinoLogger | undefined;
let cachedKey: string | undefined;

export function getMastraLogger(): PinoLogger {
  const filePath = resolveLogPath(process.env.FPF_MASTRA_LOG_PATH, 'mastra.log');
  const level = normalizeLogLevel(process.env.FPF_MASTRA_LOG_LEVEL);
  const cacheKey = `${filePath}:${level}`;

  if (cachedLogger && cachedKey === cacheKey) {
    return cachedLogger;
  }

  cachedLogger = new PinoLogger({
    name: 'FPFSpecRuntime',
    level,
    prettyPrint: false,
    transports: {
      file: new FileTransport({ path: filePath }),
    },
    mixin() {
      return {
        service: 'fpf-spec-runtime',
        logFile: filePath,
      };
    },
  });
  cachedKey = cacheKey;
  return cachedLogger;
}

function normalizeLogLevel(value: string | undefined): 'debug' | 'info' | 'warn' | 'error' {
  switch (value?.trim().toLowerCase()) {
    case 'debug':
    case 'warn':
    case 'error':
      return value.trim().toLowerCase() as 'debug' | 'warn' | 'error';
    default:
      return 'info';
  }
}
