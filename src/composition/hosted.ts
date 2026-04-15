import { HonoBindings, HonoVariables, MastraServer } from '@mastra/hono';
import { Hono } from 'hono';

import { parseHostedConfig } from '../adapters/infra/config/env.js';
import { createHostedMastraRuntime } from '../adapters/hosted/mastra-runtime.js';
import { getSharedMcpComposition } from './mcp.js';

export function createHostedComposition(env: NodeJS.ProcessEnv) {
  const hostedConfig = parseHostedConfig(env);
  const mcpComposition = getSharedMcpComposition(env);
  const mcpServer =
    hostedConfig.surface === 'full'
      ? mcpComposition.fpfMemory
      : mcpComposition.fpfMemoryPublic;
  const mastra = createHostedMastraRuntime({
    logger: mcpComposition.logger,
    observability: mcpComposition.observability,
    mcpServer,
  });

  const app = new Hono<{
    Bindings: HonoBindings;
    Variables: HonoVariables;
  }>();
  const server = new MastraServer({ app, mastra });

  return {
    ...mcpComposition,
    hostedConfig,
    app,
    server,
    mastra,
  };
}
