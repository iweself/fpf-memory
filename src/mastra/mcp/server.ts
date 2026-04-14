import { MCPServer } from '@mastra/mcp';

import { fpfMcpTools, fpfPublicTools } from '../../mcp/tools.js';

export const fpfMemory = new MCPServer({
  name: 'fpf_memory',
  version: '1.0.0',
  description: 'Local vectorless MCP runtime for FPF-spec.md with full tool surface.',
  tools: fpfMcpTools,
});

export const fpfMemoryPublic = new MCPServer({
  name: 'fpf_memory',
  version: '1.0.0',
  description: 'FPF-spec query runtime with public discovery surface (browse, search, ask, query, read, status).',
  tools: fpfPublicTools,
});
