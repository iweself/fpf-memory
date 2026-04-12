import { Mastra } from '@mastra/core/mastra';
import { HonoBindings, HonoVariables, MastraServer } from '@mastra/hono';
import { Hono } from 'hono';

import { getRuntimeLogger } from '../logging/runtime-logger.js';
import { fpfMcpServer, fpfPublicMcpServer } from '../mcp/server.js';
import { getRuntimeObservability } from '../observability/runtime-observability.js';

export function createMastraRuntime(env: NodeJS.ProcessEnv = process.env) {
  const logger = getRuntimeLogger(env);
  const observability = getRuntimeObservability(env);
  const mcpServer = env.FPF_MCP_SURFACE === 'full' ? fpfMcpServer : fpfPublicMcpServer;
  const mastra = new Mastra({
    logger,
    observability: observability.observability,
    mcpServers: {
      fpf_memory: mcpServer,
    },
    server: {
      mcpOptions: { serverless: true },
    },
  });

  return {
    logger,
    observability,
    mastra,
  };
}

/**
 * Direct Mastra instance export required by `mastra build` / `mastra deploy`.
 */
export const mastra = createMastraRuntime().mastra;

export async function createHonoMastraRuntime(env: NodeJS.ProcessEnv = process.env) {
  const runtime = createMastraRuntime(env);
  const app = new Hono<{
    Bindings: HonoBindings;
    Variables: HonoVariables;
  }>();
  const server = new MastraServer({
    app,
    mastra: runtime.mastra,
  });

  await server.init();

  return {
    ...runtime,
    app,
    server,
  };
}
