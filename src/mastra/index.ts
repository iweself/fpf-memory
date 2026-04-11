import { Mastra } from '@mastra/core';

import { fpfSpecRuntimeMcpServer } from './mcp/fpf-spec-server.js';
import { getMastraLogger } from './logger.js';
import { getMastraObservability } from './observability.js';
import { fpfSpecRuntimeTools } from './tools/fpf-spec-tools.js';

export const mastra = new Mastra({
  logger: getMastraLogger(),
  observability: getMastraObservability().observability,
  tools: fpfSpecRuntimeTools,
  mcpServers: {
    fpfSpecRuntime: fpfSpecRuntimeMcpServer,
  },
});
