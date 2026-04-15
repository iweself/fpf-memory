import { PinoLogger } from '@mastra/loggers';
import { FileTransport } from '@mastra/loggers/file';

import { resolveLogPath } from '../../../logging/file-paths.js';
import type { LoggingConfig } from '../config/types.js';

let cachedLogger: PinoLogger | undefined;
let cachedKey: string | undefined;

export function getRuntimeLogger(config: LoggingConfig): PinoLogger {
  const filePath = resolveLogPath(config.filePath, 'mastra.log');
  const cacheKey = `${filePath}:${config.level}:${config.serviceName}`;

  if (cachedLogger && cachedKey === cacheKey) {
    return cachedLogger;
  }

  cachedLogger = new PinoLogger({
    name: 'FPFSpecRuntime',
    level: config.level,
    prettyPrint: false,
    transports: {
      file: new FileTransport({ path: filePath }),
    },
    mixin() {
      return {
        service: config.serviceName,
        logFile: filePath,
      };
    },
  });
  cachedKey = cacheKey;
  return cachedLogger;
}
