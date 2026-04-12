#!/usr/bin/env node
import { getRuntimeLogger } from '../logging/runtime-logger.js';
import { fpfMemory, fpfMemoryPublic } from './mcp/server.js';

const logger = getRuntimeLogger();
const server = process.env.FPF_MCP_SURFACE === 'full' ? fpfMemory : fpfMemoryPublic;

logger.info('MCP stdio server start');

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

server
  .startStdio()
  .catch(async (error) => {
    logger.error('MCP stdio server failed', {
      error: normalizeErrorMessage(error),
      cause: error instanceof Error ? error.stack ?? error : error,
    });
    await new Promise<void>((resolve) => setImmediate(resolve));
    process.exit(1);
  });
