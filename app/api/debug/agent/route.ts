import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { agentHistory } from '@/lib/server/agora';
import { readSandbox } from '@/lib/server/store';

// Test-only: read an agent's conversation history (what ASR heard and what the agent
// replied). Protected by TOOL_SECRET; used by the end-to-end test harness.

function authorized(key: string | null): boolean {
  const secret = process.env.TOOL_SECRET ?? '';
  if (!key || secret.length < 16 || key.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(key), Buffer.from(secret));
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (!authorized(params.get('key'))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const agentId = params.get('agentId');
  if (!agentId) return NextResponse.json({ error: 'agentId required' }, { status: 400 });
  let channel = params.get('channel');
  if (!channel && params.get('sandbox')) channel = (await readSandbox(params.get('sandbox')!))?.call?.channel ?? null;
  if (!channel) return NextResponse.json({ error: 'channel required' }, { status: 400 });
  try {
    return NextResponse.json(await agentHistory(agentId, channel));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
