import { getSharedMcpComposition } from '../../composition/mcp.js';

export * from '../../adapters/mcp/server.js';

const { fpfMemory, fpfMemoryPublic } = getSharedMcpComposition(process.env);

export { fpfMemory, fpfMemoryPublic };
