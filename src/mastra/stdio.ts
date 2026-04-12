import { fpfMemory, fpfMemoryPublic } from './mcp/server.js';

const server = process.env.FPF_MCP_SURFACE === 'full' ? fpfMemory : fpfMemoryPublic;

server.startStdio().catch((error) => {
  console.error('Error running MCP server:', error);
  process.exit(1);
});
