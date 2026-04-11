import { describe, expect, it } from '@rstest/core';

import { FpfMcpServer, parseJsonRpcPayload } from '../src/mcp/server.js';

describe('FpfMcpServer', () => {
  async function initializeServer(): Promise<FpfMcpServer> {
    const server = new FpfMcpServer();
    const initialize = await server.handleMessage({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
      },
    });

    expect(asResult(initialize)?.protocolVersion).toBe('2024-11-05');

    const initialized = await server.handleMessage({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    });
    expect(initialized).toBe(null);

    return server;
  }

  it('accepts initialize, notifications/initialized, and ping', async () => {
    const server = await initializeServer();

    const ping = await server.handleMessage({
      jsonrpc: '2.0',
      id: 2,
      method: 'ping',
    });

    expect(asResult(ping)).toEqual({});
  });

  it('downgrades unsupported initialize protocol versions to the supported version', async () => {
    const server = new FpfMcpServer();

    const initialize = await server.handleMessage({
      jsonrpc: '2.0',
      id: 7,
      method: 'initialize',
      params: {
        protocolVersion: '2025-01-01',
      },
    });

    expect(asResult(initialize)?.protocolVersion).toBe('2024-11-05');
  });

  it('lists only canonical snake_case tools with plain JSON Schema objects', async () => {
    const server = await initializeServer();

    const toolsList = await server.handleMessage({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/list',
    });
    const tools = asResult(toolsList)?.tools as Array<{
      name: string;
      inputSchema: Record<string, unknown>;
    }>;

    expect(tools.map((tool) => tool.name)).toEqual([
      'refresh_fpf_index',
      'get_fpf_index_status',
      'query_fpf_spec',
      'trace_fpf_path',
      'inspect_fpf_node',
      'inspect_fpf_anchor',
      'expand_fpf_citations',
      'ask_fpf',
    ]);

    for (const tool of tools) {
      expect(tool.name).toMatch(/^[a-z0-9_]+$/);
      expect(typeof tool.inputSchema).toBe('object');
      expect(tool.inputSchema).not.toBe(null);
      expect(tool.inputSchema['~standard']).toBeUndefined();
    }

    expect(
      tools.find((tool) => tool.name === 'get_fpf_index_status')?.inputSchema,
    ).toEqual({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {},
      additionalProperties: false,
    });
  });

  it('serves query_fpf_spec and get_fpf_index_status without async schema failures', async () => {
    const server = await initializeServer();

    const status = await server.handleMessage({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'get_fpf_index_status',
        arguments: {},
      },
    });
    const statusResult = asToolPayload(status);
    expect(typeof statusResult.snapshotExists).toBe('boolean');
    expect(statusResult.compilerMode).toBe('local_vectorless');

    const query = await server.handleMessage({
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: {
        name: 'query_fpf_spec',
        arguments: {
          question: 'What is U.BoundedContext?',
        },
      },
    });
    const queryResult = asToolPayload(query);
    expect(queryResult.mode).toBe('verbose');
    expect((queryResult.ids as string[])).toContain('A.1.1');
    expect((queryResult.citations as string[]).some((citation) => citation.startsWith('A.1.1'))).toBe(
      true,
    );
  });

  it('renders ask_fpf as markdown with grounding metadata', async () => {
    const server = await initializeServer();

    const ask = await server.handleMessage({
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: {
        name: 'ask_fpf',
        arguments: {
          question: 'Give me a checklist for how to model my project information system.',
        },
      },
    });
    const askResult = asToolPayload(ask);

    expect(askResult.mode).toBe('verbose');
    expect(askResult.markdown).toContain('## Result');
    expect(askResult.markdown).toContain('## Grounding');
    expect(Array.isArray(askResult.ids)).toBe(true);
    expect(Array.isArray(askResult.citations)).toBe(true);
  });

  it('reports malformed JSON payloads as parse errors', async () => {
    const parsed = parseJsonRpcPayload('{not-json');

    expect(parsed.ok).toBe(false);
    if (parsed.ok) {
      throw new Error('Expected malformed JSON to fail parsing.');
    }
    expect(parsed.error.error?.code).toBe(-32700);
  });
});

function asResult(message: unknown): Record<string, unknown> | undefined {
  if (!message || Array.isArray(message) || typeof message !== 'object') {
    return undefined;
  }
  return (message as { result?: Record<string, unknown> }).result;
}

function asToolPayload(message: unknown): Record<string, unknown> {
  const result = asResult(message);
  expect(result?.isError).not.toBe(true);
  return (result?.structuredContent ?? {}) as Record<string, unknown>;
}
