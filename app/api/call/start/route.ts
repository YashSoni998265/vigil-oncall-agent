import { NextRequest, NextResponse } from 'next/server';
import { RtcRole, RtcTokenBuilder } from 'agora-token';
import { SANDBOX_ID, readSandbox } from '@/lib/server/store';
import { answerCall, canStartCall, isOwner } from '@/lib/server/engine';

// The engineer answers (or calls Vigil back). Gated: an open incident, and the
// per-sandbox and daily call limits that protect Agora minutes and Murf credits.
// Returns an RTC + RTM token for a fresh channel; the agent is invited next.

const TOKEN_TTL_SECONDS = 60 * 20;

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { id?: string };
  const id = String(body.id ?? '');
  if (!SANDBOX_ID.test(id)) return NextResponse.json({ error: 'invalid sandbox id' }, { status: 400 });
  const sb = await readSandbox(id);
  if (!sb) return NextResponse.json({ error: 'sandbox not found' }, { status: 404 });

  const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
  const cert = process.env.NEXT_AGORA_APP_CERTIFICATE;
  if (!appId || !cert) return NextResponse.json({ error: 'Agora credentials are not configured' }, { status: 500 });

  const gate = await canStartCall(sb, isOwner(request.headers.get('x-owner-key')));
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  await answerCall(id);
  const uid = String(Math.floor(Math.random() * 8_000_000) + 1_000_000);
  const channel = `vigil-${id}-${Date.now().toString(36)}`;
  const expires = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const token = RtcTokenBuilder.buildTokenWithRtm(appId, cert, channel, uid, RtcRole.PUBLISHER, expires, expires);
  return NextResponse.json({ appId, channel, uid, token });
}
