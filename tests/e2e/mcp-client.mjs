// MCP conformance: connects to Vigil's /api/mcp with the official MCP TypeScript client, the way
// any MCP client (Agora's Conversational AI Engine included) would: initialize → initialized →
// tools/list → tools/call. Costs no Agora minutes.
// Usage: BASE=https://vigil-oncall.vercel.app node mcp-client.mjs   (default BASE: http://localhost:3000)
import fs from 'node:fs';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const BASE = process.env.BASE ?? 'http://localhost:3000';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const ENV = fs.readFileSync(path.resolve(HERE, '../../.env.local'), 'utf8');
const SECRET = /^TOOL_SECRET=(.*)$/m.exec(ENV)[1].trim();

const post = (body) => fetch(`${BASE}/api/sandbox`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());
const text = (result) => JSON.parse(result.content?.[0]?.text ?? '{}');

let failures = 0;
const check = (label, ok, extra = '') => {
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? `  (${extra})` : ''}`);
};

const { id } = await post({ action: 'create', name: 'Priya' });
await post({ id, action: 'trigger', scenario: 'bad_deploy' });

const transport = new StreamableHTTPClientTransport(new URL(`${BASE}/api/mcp`), {
  requestInit: { headers: { 'x-tool-secret': SECRET, 'x-sandbox': id } },
});
const client = new Client({ name: 'vigil-mcp-conformance', version: '1.0.0' });
await client.connect(transport);

const server = client.getServerVersion();
check('the official client completes the MCP handshake', server?.name === 'vigil', `${server?.name} ${server?.version}`);
check('the server advertises tools', Boolean(client.getServerCapabilities()?.tools));

const { tools } = await client.listTools();
check('tools/list returns the 13 tools', tools.length === 13);
const exec = tools.find((t) => t.name === 'execute_remediation');
check('execute_remediation is marked destructive and keeps its action enum', exec?.annotations?.destructiveHint === true && exec?.inputSchema?.properties?.action?.enum?.length === 7);

const incident = text(await client.callTool({ name: 'get_incident', arguments: {} }));
check('tools/call reads the live incident', /^INC-/.test(incident.incident_id ?? ''), incident.incident_id);

const refused = text(await client.callTool({ name: 'execute_remediation', arguments: { action: 'disable_feature_flag', target: 'new-coupon-engine', approval_quote: 'yes' } }));
check('a change with no human yes is refused', refused.executed !== true, refused.reason ?? refused.error);

await post({ id, action: 'typed', text: 'Okay, turn the flag off.' });
const done = text(await client.callTool({ name: 'execute_remediation', arguments: { action: 'disable_feature_flag', target: 'new-coupon-engine', approval_quote: 'Okay, turn the flag off.' } }));
check("the engineer's typed yes switches the flag off", done.executed === true);

const recovery = await client.callTool({ name: 'verify_recovery', arguments: {} });
check('verify_recovery answers', recovery.isError === false);

let rejected = false;
try {
  await client.callTool({ name: 'drop_database', arguments: {} });
} catch {
  rejected = true;
}
check('an unknown tool is rejected', rejected);
check('ping', (await client.ping()) !== undefined);
await client.close();

console.log(failures ? `\n${failures} CHECK(S) FAILED` : '\nALL MCP CHECKS PASSED');
process.exit(failures ? 1 : 0);
