import readline from 'node:readline';

import { getRuntimeLogger } from '../logging/runtime-logger.js';
import { fpfMcpToolMap, fpfMcpTools } from './tools.js';

type JsonRpcId = string | number | null;

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: JsonRpcId;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

const DEFAULT_PROTOCOL_VERSION = '2024-11-05';
const SUPPORTED_PROTOCOL_VERSIONS = new Set([DEFAULT_PROTOCOL_VERSION]);

export class FpfMcpServer {
  private readonly logger = getRuntimeLogger();
  private initialized = false;
  private ready = false;
  private protocolVersion = DEFAULT_PROTOCOL_VERSION;

  async handleMessage(message: unknown): Promise<JsonRpcResponse | JsonRpcResponse[] | null> {
    if (Array.isArray(message)) {
      const responses = (
        await Promise.all(message.map((item) => this.handleSingleMessage(item)))
      ).filter((value): value is JsonRpcResponse => value !== null);
      return responses.length > 0 ? responses : null;
    }

    return this.handleSingleMessage(message);
  }

  private async handleSingleMessage(message: unknown): Promise<JsonRpcResponse | null> {
    if (!isRequest(message)) {
      return invalidRequest(null, 'Invalid JSON-RPC request.');
    }

    if (message.method === 'notifications/initialized') {
      this.ready = true;
      return null;
    }

    if (message.method === 'initialize') {
      return this.handleInitialize(message);
    }

    if (!this.initialized) {
      return protocolError(message.id ?? null, 'Server has not been initialized yet.');
    }

    switch (message.method) {
      case 'ping':
        return { jsonrpc: '2.0', id: message.id ?? null, result: {} };
      case 'tools/list':
        return {
          jsonrpc: '2.0',
          id: message.id ?? null,
          result: {
            tools: fpfMcpTools.map((tool) => ({
              name: tool.name,
              description: tool.description,
              inputSchema: tool.inputContract.jsonSchema,
            })),
          },
        };
      case 'tools/call':
        return this.handleToolCall(message);
      default:
        return methodNotFound(message.id ?? null, `Unknown method: ${message.method}`);
    }
  }

  private handleInitialize(message: JsonRpcRequest): JsonRpcResponse {
    const requestedVersion = typeof message.params?.protocolVersion === 'string'
      ? message.params.protocolVersion
      : DEFAULT_PROTOCOL_VERSION;
    this.protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.has(requestedVersion)
      ? requestedVersion
      : DEFAULT_PROTOCOL_VERSION;
    this.initialized = true;

    return {
      jsonrpc: '2.0',
      id: message.id ?? null,
      result: {
        protocolVersion: this.protocolVersion,
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: 'fpf_memory',
          version: '1.0.0',
        },
      },
    };
  }

  private async handleToolCall(message: JsonRpcRequest): Promise<JsonRpcResponse> {
    const toolName = typeof message.params?.name === 'string' ? message.params.name : undefined;
    const tool = toolName ? fpfMcpToolMap[toolName] : undefined;
    const id = message.id ?? null;

    if (!toolName || !tool) {
      return {
        jsonrpc: '2.0',
        id,
        result: asToolResult({
          ok: false,
          name: toolName ?? 'unknown',
          message: `Unknown tool: ${toolName ?? 'undefined'}`,
        }),
      };
    }

    const normalizedArgs = normalizeToolArgs(tool.inputContract.jsonSchema, message.params?.arguments);
    const validatedInput = tool.inputContract.validate(normalizedArgs);
    if (!validatedInput.success) {
      return {
        jsonrpc: '2.0',
        id,
        result: asToolResult({
          ok: false,
          name: tool.name,
          message: validatedInput.error,
          input: normalizedArgs,
        }),
      };
    }

    try {
      const output = await tool.execute(validatedInput.value);
      const validatedOutput = tool.outputContract.validate(output);
      if (!validatedOutput.success) {
        return {
          jsonrpc: '2.0',
          id,
          result: asToolResult({
            ok: false,
            name: tool.name,
            message: `Tool output failed contract validation: ${validatedOutput.error}`,
          }),
        };
      }

      return {
        jsonrpc: '2.0',
        id,
        result: asToolResult({
          ok: true,
          name: tool.name,
          payload: validatedOutput.value,
        }),
      };
    } catch (error) {
      this.logger.error('MCP tool call failed', {
        tool: tool.name,
        error: error instanceof Error ? error.message : 'Unknown MCP tool error',
      });
      return {
        jsonrpc: '2.0',
        id,
        result: asToolResult({
          ok: false,
          name: tool.name,
          message: error instanceof Error ? error.message : 'Unknown MCP tool error',
        }),
      };
    }
  }
}

export async function startStdioMcpServer(): Promise<void> {
  const server = new FpfMcpServer();
  const rl = readline.createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
    terminal: false,
  });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const parsed = parseJsonRpcPayload(trimmed);
    if (!parsed.ok) {
      writeResponse(
        parsed.error,
      );
      continue;
    }

    const response = await server.handleMessage(parsed.value);
    if (response) {
      writeResponse(response);
    }
  }
}

export function parseJsonRpcPayload(payload: string):
  | { ok: true; value: unknown }
  | { ok: false; error: JsonRpcResponse } {
  try {
    return { ok: true, value: JSON.parse(payload) };
  } catch (error) {
    return {
      ok: false,
      error: parseError(
        null,
        `Failed to parse JSON-RPC payload: ${error instanceof Error ? error.message : 'unknown parse error'}`,
      ),
    };
  }
}

function normalizeToolArgs(schema: Record<string, unknown>, value: unknown): unknown {
  const type = schema.type;
  if (value !== undefined && value !== null) {
    return value;
  }

  if (type === 'object') {
    return {};
  }
  if (type === 'array') {
    return [];
  }
  return value;
}

function asToolResult(input: {
  ok: true;
  name: string;
  payload: unknown;
} | {
  ok: false;
  name: string;
  message: string;
  input?: unknown;
}): {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: unknown;
  isError?: boolean;
} {
  if (input.ok) {
    return {
      content: [{ type: 'text', text: JSON.stringify(input.payload, null, 2) }],
      structuredContent: input.payload,
    };
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(
        {
          tool: input.name,
          error: input.message,
          input: input.input,
        },
        null,
        2,
      ),
    }],
    isError: true,
  };
}

function writeResponse(response: JsonRpcResponse | JsonRpcResponse[]): void {
  process.stdout.write(`${JSON.stringify(response)}\n`);
}

function isRequest(value: unknown): value is JsonRpcRequest {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { jsonrpc?: unknown }).jsonrpc === '2.0' &&
    typeof (value as { method?: unknown }).method === 'string'
  );
}

function invalidRequest(id: JsonRpcId, message: string): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code: -32600,
      message,
    },
  };
}

function parseError(id: JsonRpcId, message: string): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code: -32700,
      message,
    },
  };
}

function methodNotFound(id: JsonRpcId, message: string): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code: -32601,
      message,
    },
  };
}

function protocolError(id: JsonRpcId, message: string): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code: -32002,
      message,
    },
  };
}
