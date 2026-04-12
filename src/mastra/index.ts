import { Mastra } from '@mastra/core/mastra';

import { getRuntimeLogger } from '../logging/runtime-logger.js';
import { fpfMemory, fpfMemoryPublic } from './mcp/server.js';
import { getRuntimeObservability } from '../observability/runtime-observability.js';

export function createMastraRuntime(env: NodeJS.ProcessEnv = process.env) {
  const logger = getRuntimeLogger(env);
  const observability = getRuntimeObservability(env);
  const mcpServer = env.FPF_MCP_SURFACE === 'full' ? fpfMemory : fpfMemoryPublic;

  return new Mastra({
    logger,
    observability: observability.observability,
    mcpServers: {
      fpf_memory: mcpServer,
    },
    server: {
      mcpOptions: { serverless: true },
    },
  });
}

/**
 * Direct Mastra instance export required by `mastra build` / `mastra deploy`.
 * Deployed server sets FPF_MCP_SURFACE=public to restrict to 3 public tools.
 */
export const mastra = createMastraRuntime();
