import { createHostedComposition } from '../composition/hosted.js';

export async function main(): Promise<void> {
  const { logger, hostedConfig, app, server } = createHostedComposition(process.env);

  await server.init();

  const httpServer = Bun.serve({
    fetch: app.fetch,
    port: hostedConfig.port,
  });

  logger.info('Mastra Hono server start', {
    port: httpServer.port,
  });
}
