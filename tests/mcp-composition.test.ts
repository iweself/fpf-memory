import { describe, expect, it } from '@rstest/core';

import { DEFAULT_SOURCE_PATH } from '../src/core/constants.js';
import { getSharedMcpComposition } from '../src/composition/mcp.js';

describe('MCP composition sharing', () => {
  it('does not reuse process-global composition for custom env objects', () => {
    const publicComposition = getSharedMcpComposition({
      FPF_SPEC_SOURCE_PATH: DEFAULT_SOURCE_PATH,
      FPF_MCP_SURFACE: 'public',
    } as NodeJS.ProcessEnv);
    const fullComposition = getSharedMcpComposition({
      FPF_SPEC_SOURCE_PATH: DEFAULT_SOURCE_PATH,
      FPF_MCP_SURFACE: 'full',
    } as NodeJS.ProcessEnv);

    expect(publicComposition).not.toBe(fullComposition);
    expect(publicComposition.mcpConfig.surface).toBe('public');
    expect(fullComposition.mcpConfig.surface).toBe('full');
  });
});
