import { MCPServer } from '@mastra/mcp';

import { fpfMcpTools, fpfPublicTools } from './tools.js';

export type McpToolSurface = 'public' | 'full';

export function createFpfMcpServer(surface: McpToolSurface = 'full'): MCPServer {
  const tools = surface === 'public' ? fpfPublicTools : fpfMcpTools;
  return new MCPServer({
    name: 'fpf_memory',
    version: '1.0.0',
    description:
      surface === 'public'
        ? 'FPF-spec query runtime with answer, structured query, and status tools.'
        : 'Local vectorless MCP runtime for FPF-spec.md with refresh, query, trace, status, node inspect, direct doc read, anchor inspect, citation expansion, and markdown answer tools.',
    tools,
  });
}

/** Deployed MCP — public tools only. */
export const fpfPublicMcpServer = createFpfMcpServer('public');

/** Local MCP — all tools. */
export const fpfMcpServer = createFpfMcpServer('full');

export async function startStdioMcpServer(): Promise<void> {
  await fpfMcpServer.startStdio();
}
