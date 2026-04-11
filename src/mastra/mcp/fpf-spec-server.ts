import { MCPServer } from '@mastra/mcp';

import { fpfSpecRuntimeTools } from '../tools/fpf-spec-tools.js';

export const fpfSpecRuntimeMcpServer = new MCPServer({
  name: 'FPF Spec Runtime',
  version: '0.1.0',
  description:
    'Local vectorless MCP runtime for FPF-spec.md with refresh, query, inspect, trace, and status tools.',
  tools: fpfSpecRuntimeTools,
});
