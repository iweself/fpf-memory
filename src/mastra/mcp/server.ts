import { MCPServer } from '@mastra/mcp';

import { fpfMcpTools, fpfPublicTools } from '../../mcp/tools.js';

export const fpfMemory = new MCPServer({
  name: 'fpf_memory',
  version: '1.0.0',
  tools: fpfMcpTools,
});

export const fpfMemoryPublic = new MCPServer({
  name: 'fpf_memory',
  version: '1.0.0',
  tools: fpfPublicTools,
});
