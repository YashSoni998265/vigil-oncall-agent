import { NextResponse, after } from 'next/server';
import { SANDBOX_ID } from '@/lib/server/store';
import { endCall, runEffects } from '@/lib/server/engine';
import { stopAgent } from '@/lib/server/agora';

// The engineer hangs up: stop the agent (idempotent) and close the call in the sandbox.

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { agent_id?: string; sandbox_id?: string };
  const agentId = typeof body.agent_id === 'string' ? body.agent_id : '';
  const sandboxId = typeof body.sandbox_id === 'string' ? body.sandbox_id : '';
  if (!agentId && !SANDBOX_ID.test(sandboxId)) {
    return NextResponse.json({ error: 'agent_id or sandbox_id is required' }, { status: 400 });
  }
  if (SANDBOX_ID.test(sandboxId)) {
    const effects = await endCall(sandboxId, agentId || null);
    if (effects.length) after(() => runEffects(effects));
    else if (agentId) after(() => stopAgent(agentId));
  } else if (agentId) {
    after(() => stopAgent(agentId));
  }
  return NextResponse.json({ success: true });
}
