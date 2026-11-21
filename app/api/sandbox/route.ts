import { NextRequest, NextResponse, after } from 'next/server';
import type { ScenarioId } from '@/lib/types';
import { SCENARIOS } from '@/lib/sim';
import { SANDBOX_ID, readSandbox } from '@/lib/server/store';
import {
  addTyped,
  declineCall,
  endCall,
  isOwner,
  failCall,
  heartbeat,
  mergeCaptions,
  newSandbox,
  resetSandbox,
  restartVoice,
  runEffects,
  setEngineer,
  setLanguage,
  teammateAsk,
  teammateJoined,
  triggerIncident,
  setThreshold,
  viewSandbox,
} from '@/lib/server/engine';

// One visitor = one private sandbox of Thali's production.
// GET  /api/sandbox?id=…           → live view (runs the lazy clock: rings, retries, recovery)
// POST /api/sandbox {action:'create'} → new sandbox
// POST /api/sandbox {id, action, …}   → console actions

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id') ?? '';
  if (!SANDBOX_ID.test(id)) return NextResponse.json({ error: 'invalid sandbox id' }, { status: 400 });
  const result = await viewSandbox(id, request.headers.get('x-owner-key'));
  if (!result) return NextResponse.json({ error: 'sandbox not found' }, { status: 404 });
  // Live updates into the call (e.g. "errors back to 0.4%") must finish even on serverless.
  if (result.effects.length) after(() => runEffects(result.effects));
  return NextResponse.json(result.view, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action ?? '');

  if (action === 'create') {
    const sb = await newSandbox(typeof body.name === 'string' ? body.name : undefined, isOwner(request.headers.get('x-owner-key')));
    return NextResponse.json({ id: sb.id });
  }

  const id = String(body.id ?? '');
  if (!SANDBOX_ID.test(id)) return NextResponse.json({ error: 'invalid sandbox id' }, { status: 400 });
  if (!(await readSandbox(id))) return NextResponse.json({ error: 'sandbox not found' }, { status: 404 });

  switch (action) {
    case 'trigger': {
      const scenario = String(body.scenario ?? '') as ScenarioId;
      if (!SCENARIOS[scenario]) return NextResponse.json({ error: 'unknown scenario' }, { status: 400 });
      const r = await triggerIncident(id, scenario);
      if (r.effects.length) after(() => runEffects(r.effects));
      return NextResponse.json(r.ok ? { ok: true } : { ok: false, error: r.error }, { status: r.ok ? 200 : 409 });
    }
    case 'reset': {
      const effects = await resetSandbox(id);
      if (effects.length) after(() => runEffects(effects));
      return NextResponse.json({ ok: true });
    }
    case 'set_name': {
      const ok = await setEngineer(id, String(body.name ?? ''));
      return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
    }
    case 'set_threshold': {
      // The team's own alert level for one metric; null clears it.
      const value = body.value === null ? null : Number(body.value);
      const ok = await setThreshold(id, String(body.metric ?? ''), value);
      return NextResponse.json(ok ? { ok } : { ok, error: 'unknown metric or invalid threshold' }, { status: ok ? 200 : 400 });
    }
    case 'set_language': {
      // 'hi' (Hindi mode): the next call hears Hindi and Vigil answers in Hinglish. Anything but 'en' or 'hi' is a 400.
      const ok = await setLanguage(id, typeof body.language === 'string' ? body.language : '');
      return NextResponse.json(ok ? { ok } : { ok, error: "language must be 'en' or 'hi'" }, { status: ok ? 200 : 400 });
    }
    case 'decline':
      await declineCall(id);
      return NextResponse.json({ ok: true });
    case 'fail':
      await failCall(id, String(body.reason ?? 'unknown error'));
      return NextResponse.json({ ok: true });
    case 'end': {
      const effects = await endCall(id, typeof body.agentId === 'string' ? body.agentId : null);
      if (effects.length) after(() => runEffects(effects));
      return NextResponse.json({ ok: true });
    }
    case 'heartbeat':
      await heartbeat(id);
      return NextResponse.json({ ok: true });
    case 'restart_voice': {
      // Stop the silent agent before answering, so the fresh one never shares the call with it.
      const r = await restartVoice(id);
      await runEffects(r.effects);
      return NextResponse.json({ ok: r.ok }, { status: r.ok ? 200 : 409 });
    }
    case 'captions': {
      const lines = Array.isArray(body.lines) ? (body.lines as { who: string; text: string }[]) : [];
      await mergeCaptions(id, lines);
      return NextResponse.json({ ok: true });
    }
    case 'typed':
      await addTyped(id, String(body.text ?? ''));
      return NextResponse.json({ ok: true });
    case 'teammate_joined':
      await teammateJoined(id);
      return NextResponse.json({ ok: true });
    case 'teammate_ask': {
      // A teammate on the call asks Vigil a question from their phone; Vigil answers out loud.
      const r = await teammateAsk(id, String(body.text ?? ''));
      if (r.effects.length) after(() => runEffects(r.effects));
      return NextResponse.json(r.ok ? { ok: true } : { ok: false, error: r.error }, { status: r.status });
    }
    default:
      return NextResponse.json({ error: `unknown action: ${action}` }, { status: 400 });
  }
}
