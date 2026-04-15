import { MCPServer } from '@mastra/mcp';
import type { createMcpTools } from './tools.js';

export function createMcpServerSet(
  tools: ReturnType<typeof createMcpTools>,
) {
  const fpfMemory = new MCPServer({
    name: 'fpf_memory',
    version: '1.0.0',
    description: 'Local vectorless MCP runtime for the FPF spec with full tool surface.',
    tools: tools.fpfMcpTools,
  });

  const fpfMemoryPublic = new MCPServer({
    name: 'fpf_memory',
    version: '1.0.0',
    description:
      'FPF spec query runtime with public discovery surface (browse, search, ask, query, read, status).',
    tools: tools.fpfPublicTools,
  });

  return {
    fpfMemory,
    fpfMemoryPublic,
  };
}
