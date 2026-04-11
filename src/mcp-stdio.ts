import { getMastraLogger } from './mastra/logger.js';
import { fpfSpecRuntimeMcpServer } from './mastra/mcp/fpf-spec-server.js';

const logger = getMastraLogger();

logger.info('MCP stdio server start');

try {
  await fpfSpecRuntimeMcpServer.startStdio();
} catch (error) {
  logger.error('MCP stdio server failed', {
    error: error instanceof Error ? error.message : 'Unknown MCP stdio error',
  });
  throw error;
}
