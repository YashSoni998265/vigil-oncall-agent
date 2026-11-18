import { NextRequest, NextResponse } from 'next/server';
import { RtcRole, RtcTokenBuilder } from 'agora-token';
import { SANDBOX_ID, readSandbox } from '@/lib/server/store';
import { TEAMMATE_UID } from '@/lib/agora';

// A paged teammate joins the engineer's live incident call (same Agora RTC channel).
// Only works while that call is active and after Vigil has paged someone.

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { id?: string };
  const id = String(body.id ?? '');
  if (!SANDBOX_ID.test(id)) return NextResponse.json({ error: 'invalid sandbox id' }, { status: 400 });
  const sb = await readSandbox(id);
  if (!sb) return NextResponse.json({ error: 'sandbox not found' }, { status: 404 });
  const call = sb.call;
  if (!call || call.status !== 'active' || !call.channel) {
    return NextResponse.json({ error: 'There is no live incident call to join right now.' }, { status: 409 });
  }
  if (!call.teammatePaged) {
    return NextResponse.json({ error: 'Nobody has been paged into this call yet. Ask Vigil to add a teammate.' }, { status: 409 });
  }
  const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
  const cert = process.env.NEXT_AGORA_APP_CERTIFICATE;
  if (!appId || !cert) return NextResponse.json({ error: 'Agora credentials are not configured' }, { status: 500 });
  const uid = String(TEAMMATE_UID);
  const expires = Math.floor(Date.now() / 1000) + 60 * 20;
  const token = RtcTokenBuilder.buildTokenWithRtm(appId, cert, call.channel, uid, RtcRole.PUBLISHER, expires, expires);
  return NextResponse.json({ appId, channel: call.channel, uid, token, name: call.teammatePaged.name, incident: sb.incident?.id ?? null });
}
