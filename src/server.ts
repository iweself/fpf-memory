import { HonoBindings, HonoVariables, MastraServer } from '@mastra/hono';
import { Hono } from 'hono';

import { getRuntimeLogger } from './logging/runtime-logger.js';
import { createMastraRuntime } from './mastra/index.js';
import { parsePort } from './server-config.js';

const logger = getRuntimeLogger();
const port = parsePort(process.env.PORT);
const mastra = createMastraRuntime();

const app = new Hono<{
  Bindings: HonoBindings;
  Variables: HonoVariables;
}>();

const server = new MastraServer({ app, mastra });
await server.init();

const httpServer = Bun.serve({
  fetch: app.fetch,
  port,
});

logger.info('Mastra Hono server start', {
  port: httpServer.port,
});
