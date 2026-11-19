import { NextRequest, NextResponse, after } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { handleMcpMessage } from '@/lib/server/mcp';
import { runEffects, type Effect } from '@/lib/server/engine';
import { SANDBOX_ID } from '@/lib/server/store';

// Vigil's tools as an MCP server (Streamable HTTP). Agora's Conversational AI Engine connects here
// when AGENT_TOOLS selects MCP; the shared secret and the visitor's sandbox id arrive as headers,
// exactly as they do for the HTTPS tools. Stateless: no sessions and no server-to-client stream.

// The approval check may wait a few seconds for captions; keep the function alive past Vercel's default.
export const maxDuration = 30;

function authorized(request: NextRequest): boolean {
  const secret = process.env.TOOL_SECRET ?? '';
  const given = request.headers.get('x-tool-secret') ?? '';
  if (secret.length < 16 || given.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(secret));
}

const rpcError = (code: number, message: string, status: number) =>
  NextResponse.json({ jsonrpc: '2.0', id: null, error: { code, message } }, { status });

export async function POST(request: NextRequest) {
  if (!authorized(request)) return rpcError(-32001, 'unauthorized', 401);
  const header = request.headers.get('x-sandbox') ?? '';
  const sandbox = SANDBOX_ID.test(header) ? header : null;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return rpcError(-32700, 'Parse error', 400);
  }
  // One message per POST in current MCP; older clients may batch an array.
  const batch = Array.isArray(payload);
  const messages: unknown[] = batch ? (payload as unknown[]) : [payload];
  if (messages.length === 0) return rpcError(-32600, 'Invalid Request', 400);

  const responses = [];
  const effects: Effect[] = [];
  for (const message of messages) {
    const startedAt = Date.now();
    const reply = await handleMcpMessage(message, sandbox);
    console.log(`[mcp] ${reply.log} in ${Date.now() - startedAt}ms`);
    if (reply.response) responses.push(reply.response);
    effects.push(...reply.effects);
  }
  if (effects.length) after(() => runEffects(effects));

  // Notifications and client responses are acknowledged with an empty 202.
  if (responses.length === 0) return new NextResponse(null, { status: 202 });
  return NextResponse.json(batch ? responses : responses[0], { headers: { 'Cache-Control': 'no-store' } });
}

// No server-initiated stream and no sessions to end.
export function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: 'POST' } });
}

export function DELETE() {
  return new NextResponse(null, { status: 405, headers: { Allow: 'POST' } });
}
