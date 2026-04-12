#!/usr/bin/env bun
import { getRuntimeLogger } from '../logging/runtime-logger.js';
import { fpfMemory, fpfMemoryPublic } from './mcp/server.js';

const logger = getRuntimeLogger();
const server = process.env.FPF_MCP_SURFACE === 'full' ? fpfMemory : fpfMemoryPublic;

logger.info('MCP stdio server start');

server.startStdio().catch((error) => {
  logger.error('MCP stdio server failed', {
    error: error instanceof Error ? error.message : 'Unknown MCP stdio error',
  });
  process.exit(1);
});
