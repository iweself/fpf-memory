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
  if (value === undefined) {
    return 4111;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return 4111;
  }

  return Math.min(65_535, Math.max(1, parsed));
}
