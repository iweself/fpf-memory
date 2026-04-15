import { parseAnswerMode } from '../adapters/infra/config/env.js';

export * from '../adapters/mcp/tools.js';

export function resolveDefaultQueryMode(env: NodeJS.ProcessEnv = process.env) {
  return parseAnswerMode(env.FPF_QUERY_DEFAULT_MODE);
}
