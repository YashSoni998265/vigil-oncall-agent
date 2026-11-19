import 'server-only';
import { runTool } from './tools';
import { TOOL_NAMES, mcpTools } from './agent-tools';
import type { Effect } from './engine';

// A minimal, stateless MCP server (Streamable HTTP, JSON responses) for Vigil's 13 tools.
// Agora's Conversational AI Engine is the client: initialize → notifications/initialized →
// tools/list → tools/call. Every tools/call runs the same runTool() as the HTTPS tools, so the
// approval guard, refusals and audit trail are identical whichever way Agora connects.

export const MCP_PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'] as const;
const LATEST = '2025-06-18';

export const SERVER_INFO = { name: 'vigil', title: 'Vigil incident tools', version: '1.0.0' };

type JsonRpcId = string | number | null;
type JsonRpcResponse =
  | { jsonrpc: '2.0'; id: JsonRpcId; result: unknown }
  | { jsonrpc: '2.0'; id: JsonRpcId; error: { code: number; message: string } };

export interface McpReply {
  /** null for notifications and for responses the client sends us: answer with HTTP 202. */
  response: JsonRpcResponse | null;
  effects: Effect[];
  /** One line for the server log. */
  log: string;
}

const ok = (id: JsonRpcId, result: unknown): JsonRpcResponse => ({ jsonrpc: '2.0', id, result });
const fail = (id: JsonRpcId, code: number, message: string): JsonRpcResponse => ({ jsonrpc: '2.0', id, error: { code, message } });

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** Handle one JSON-RPC message. `sandbox` is the caller's x-sandbox header (already validated, or null). */
export async function handleMcpMessage(message: unknown, sandbox: string | null): Promise<McpReply> {
  if (!isRecord(message) || message.jsonrpc !== '2.0') {
    return { response: fail(null, -32600, 'Invalid Request'), effects: [], log: 'invalid request' };
  }
  const hasId = 'id' in message && (typeof message.id === 'string' || typeof message.id === 'number');
  const id: JsonRpcId = hasId ? (message.id as string | number) : null;
  const method = typeof message.method === 'string' ? message.method : null;

  // A response or a notification from the client needs no reply.
  if (!method) return { response: null, effects: [], log: 'client response (ignored)' };
  if (!hasId) return { response: null, effects: [], log: `notification ${method}` };

  const params = isRecord(message.params) ? message.params : {};

  switch (method) {
    case 'initialize': {
      const requested = typeof params.protocolVersion === 'string' ? params.protocolVersion : '';
      const protocolVersion = (MCP_PROTOCOL_VERSIONS as readonly string[]).includes(requested) ? requested : LATEST;
      return {
        response: ok(id, {
          protocolVersion,
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions:
            "Vigil's incident tools for one sandboxed production. Read tools investigate; execute_remediation is the only way to change production and runs only after the server finds the engineer's clear yes in the live call transcript.",
        }),
        effects: [],
        log: `initialize (protocol ${protocolVersion}${requested && requested !== protocolVersion ? `, client asked ${requested}` : ''})`,
      };
    }
    case 'ping':
      return { response: ok(id, {}), effects: [], log: 'ping' };
    case 'tools/list':
      return { response: ok(id, { tools: mcpTools() }), effects: [], log: `tools/list (${TOOL_NAMES.length} tools)` };
    case 'tools/call': {
      const name = typeof params.name === 'string' ? params.name : '';
      if (!TOOL_NAMES.includes(name)) return { response: fail(id, -32602, `Unknown tool: ${name || '(none)'}`), effects: [], log: `tools/call unknown ${name}` };
      if (params.arguments !== undefined && !isRecord(params.arguments)) {
        return { response: fail(id, -32602, 'arguments must be an object'), effects: [], log: `tools/call ${name} bad arguments` };
      }
      if (!sandbox) return { response: fail(id, -32602, 'Missing or invalid x-sandbox header'), effects: [], log: `tools/call ${name} without sandbox` };
      const args = (params.arguments as Record<string, unknown> | undefined) ?? {};
      const outcome = await runTool(name, sandbox, args);
      return {
        response: ok(id, {
          content: [{ type: 'text', text: JSON.stringify(outcome.body) }],
          isError: outcome.status >= 400,
        }),
        effects: outcome.effects,
        log: `tools/call ${name} -> ${outcome.status}`,
      };
    }
    default:
      return { response: fail(id, -32601, `Method not found: ${method}`), effects: [], log: `unknown method ${method}` };
  }
}
