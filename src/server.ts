import { getRuntimeLogger } from './logging/runtime-logger.js';
import { createHonoMastraRuntime } from './mastra.js';

const logger = getRuntimeLogger();
const port = parsePort(process.env.PORT);

const { app } = await createHonoMastraRuntime();

const server = Bun.serve({
  fetch: app.fetch,
  port,
});

logger.info('Mastra Hono server start', {
  port: server.port,
});

function parsePort(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '4111', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 4111;
}
