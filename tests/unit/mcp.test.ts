import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MCP_PROTOCOL_VERSIONS, handleMcpMessage } from '../../lib/server/mcp';
import { TOOL_NAMES, buildAgentTools, buildMcpServer, mcpTools } from '../../lib/server/agent-tools';

// The MCP path must offer exactly the tools the HTTPS path offers, and speak the protocol Agora's
// MCP client expects. Tool calls that reach a sandbox are covered by tests/api.sh.

const rpc = (method: string, params?: Record<string, unknown>, id: number | string = 1) => ({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) });
const result = (reply: Awaited<ReturnType<typeof handleMcpMessage>>) => (reply.response && 'result' in reply.response ? (reply.response.result as Record<string, unknown>) : null);
const errorCode = (reply: Awaited<ReturnType<typeof handleMcpMessage>>) => (reply.response && 'error' in reply.response ? reply.response.error.code : null);

test('initialize: echoes a supported protocol version, otherwise offers the latest one we speak', async () => {
  for (const version of MCP_PROTOCOL_VERSIONS) {
    const r = result(await handleMcpMessage(rpc('initialize', { protocolVersion: version, capabilities: {}, clientInfo: { name: 't', version: '1' } }), null));
    assert.equal(r?.protocolVersion, version);
    assert.deepEqual(r?.capabilities, { tools: { listChanged: false } });
    assert.equal((r?.serverInfo as { name: string }).name, 'vigil');
  }
  const r = result(await handleMcpMessage(rpc('initialize', { protocolVersion: '1999-01-01' }), null));
  assert.equal(r?.protocolVersion, '2025-06-18');
});

test('notifications and client responses get no reply (HTTP 202)', async () => {
  assert.equal((await handleMcpMessage({ jsonrpc: '2.0', method: 'notifications/initialized' }, null)).response, null);
  assert.equal((await handleMcpMessage({ jsonrpc: '2.0', id: 7, result: {} }, null)).response, null);
});

test('ping, unknown methods and malformed messages', async () => {
  assert.deepEqual(result(await handleMcpMessage(rpc('ping'), null)), {});
  assert.equal(errorCode(await handleMcpMessage(rpc('resources/list'), null)), -32601);
  assert.equal(errorCode(await handleMcpMessage({ id: 1, method: 'ping' }, null)), -32600);
  assert.equal(errorCode(await handleMcpMessage('hello', null)), -32600);
});

test('tools/list offers exactly the HTTPS tools, with the same schemas', async () => {
  const listed = (result(await handleMcpMessage(rpc('tools/list'), null))?.tools ?? []) as ReturnType<typeof mcpTools>;
  const rest = buildAgentTools('https://example.test');
  assert.equal(listed.length, 13);
  assert.deepEqual(listed.map((t) => t.name), rest.map((t) => t.function.name));
  assert.deepEqual(listed.map((t) => t.name), [...TOOL_NAMES]);
  for (const [i, t] of listed.entries()) {
    assert.deepEqual(t.inputSchema, rest[i].function.parameters, t.name);
    assert.equal(t.description, rest[i].function.description, t.name);
  }
  const byName = Object.fromEntries(listed.map((t) => [t.name, t]));
  assert.equal(byName.execute_remediation.annotations.destructiveHint, true);
  assert.equal(byName.get_incident.annotations.readOnlyHint, true);
  assert.equal(byName.verify_recovery.annotations.readOnlyHint, true);
  assert.equal(byName.update_status_page.annotations.readOnlyHint, false);
});

test('tools/call refuses unknown tools, bad arguments and a missing sandbox before touching any data', async () => {
  assert.equal(errorCode(await handleMcpMessage(rpc('tools/call', { name: 'drop_database', arguments: {} }), 'abcdef1234')), -32602);
  assert.equal(errorCode(await handleMcpMessage(rpc('tools/call', { name: 'get_incident', arguments: ['x'] }), 'abcdef1234')), -32602);
  assert.equal(errorCode(await handleMcpMessage(rpc('tools/call', { name: 'get_incident', arguments: {} }), null)), -32602);
});

test('the MCP server entry Agora receives allows exactly the registered tools', () => {
  const entry = buildMcpServer('https://vigil.example', 'secret-0123456789abcdef', 'abcdef1234');
  assert.equal(entry.endpoint, 'https://vigil.example/api/mcp');
  assert.equal(entry.transport, 'streamable_http');
  assert.deepEqual(entry.allowed_tools, [...TOOL_NAMES]);
  assert.deepEqual(entry.headers, { 'x-tool-secret': 'secret-0123456789abcdef', 'x-sandbox': 'abcdef1234' });
  assert.ok(entry.timeout_ms >= 10000, 'the approval check can wait about 5.5 s');
  assert.match(entry.name, /^[A-Za-z0-9]{1,48}$/, 'Agora: letters and numbers only, at most 48 characters');
});
