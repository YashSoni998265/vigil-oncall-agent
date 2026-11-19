'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { RTMClient } from 'agora-rtm';
import { CheckCircle2, Loader2, Phone as PhoneIcon, PhoneIncoming, PhoneMissed, PhoneOff, Search } from 'lucide-react';
import { SCENARIOS, fmtClock } from '@/lib/sim';
import { fetchWithTimeout, ownerHeaders, postJSON } from '@/lib/use-sandbox';
import type { SandboxView } from '@/lib/types';
import { LogoMark } from '@/components/brand/Logo';
import type { CallSession } from './CallView';

const CallView = dynamic(() => import('./CallView'), { ssr: false });
const INVESTIGATION_MS = 3200;

/** A soft two-tone ring, generated with Web Audio (no audio files). */
function useRingtone(active: boolean, ctxRef: React.MutableRefObject<AudioContext | null>) {
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!active || !ctx) return;
    let stopped = false;
    const ring = () => {
      if (stopped) return;
      const t0 = ctx.currentTime;
      [0, 0.22].forEach((offset, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = i === 0 ? 880 : 1175;
        gain.gain.setValueAtTime(0, t0 + offset);
        gain.gain.linearRampToValueAtTime(0.12, t0 + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + offset + 0.32);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0 + offset);
        osc.stop(t0 + offset + 0.35);
      });
    };
    ring();
    const id = setInterval(ring, 1800);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [active, ctxRef]);
}

export default function Phone({
  view,
  now,
  audioRef,
  onChanged,
}: {
  view: SandboxView;
  now: number;
  audioRef: React.MutableRefObject<AudioContext | null>;
  onChanged: () => void;
}) {
  const sb = view.sandbox;
  const call = sb.call;
  const inc = sb.incident;
  const def = inc ? SCENARIOS[inc.scenario] : null;
  const [mode, setMode] = useState<'idle' | 'connecting' | 'call'>('idle');
  const [session, setSession] = useState<CallSession | null>(null);
  const [rtm, setRtm] = useState<RTMClient | null>(null);
  const [error, setError] = useState<string | null>(null);
  const endingRef = useRef(false);

  const ringing = mode === 'idle' && call?.status === 'ringing';
  useRingtone(ringing, audioRef);

  // On small screens, bring the phone into view when Vigil starts investigating or ringing.
  const frame = useRef<HTMLDivElement>(null);
  const callStatus = call?.status;
  useEffect(() => {
    if (callStatus !== 'investigating' && callStatus !== 'ringing') return;
    const el = frame.current;
    if (!el || window.innerWidth >= 1024) return;
    const r = el.getBoundingClientRect();
    if (r.top < 64 || r.top > window.innerHeight * 0.4) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [callStatus]);

  const start = useCallback(async () => {
    setMode('connecting');
    setError(null);
    endingRef.current = false;
    const r = await postJSON<{ appId?: string; channel?: string; uid?: string; token?: string; error?: string }>('/api/call/start', { id: sb.id });
    if (!r.ok || !r.data.token) {
      setError(r.data.error ?? 'Could not start the call.');
      setMode('idle');
      onChanged();
      return;
    }
    const { appId, channel, uid, token } = r.data as Required<typeof r.data>;
    try {
      const [agent, rtmClient] = await Promise.all([
        fetchWithTimeout(
          '/api/invite-agent',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...ownerHeaders() },
            body: JSON.stringify({ sandbox_id: sb.id, channel_name: channel, requester_id: uid }),
          },
          20_000,
        ).then(async (res) => {
          const data = (await res.json().catch(() => ({}))) as { agent_id?: string; error?: string };
          if (!res.ok || !data.agent_id) throw new Error(data.error ?? 'Vigil could not join the call.');
          return data as { agent_id: string };
        }),
        (async () => {
          const { default: AgoraRTM } = await import('agora-rtm');
          const client: RTMClient = new AgoraRTM.RTM(appId, uid);
          await client.login({ token });
          await client.subscribe(channel);
          return client;
        })(),
      ]);
      setRtm(rtmClient);
      setSession({ appId, channel, uid, token, agentId: agent.agent_id });
      setMode('call');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not connect.';
      setError(message);
      setMode('idle');
      await postJSON('/api/sandbox', { id: sb.id, action: 'fail', reason: message }).catch(() => {});
    }
    onChanged();
  }, [sb.id, onChanged]);

  const end = useCallback(
    async (reason: 'hangup' | 'time_limit' | 'server') => {
      if (endingRef.current) return;
      endingRef.current = true;
      const agentId = session?.agentId;
      setMode('idle');
      setSession(null);
      if (reason !== 'server') {
        await fetch('/api/stop-conversation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agent_id: agentId, sandbox_id: sb.id }),
        }).catch(() => {});
      }
      rtm?.logout().catch(() => {});
      setRtm(null);
      onChanged();
    },
    [session, rtm, sb.id, onChanged],
  );

  // The server can end the call too (time limit, lost connection, a new incident).
  useEffect(() => {
    if (mode === 'call' && session && call && (call.status !== 'active' || (call.agentId && call.agentId !== session.agentId))) {
      void end('server');
    }
  }, [mode, session, call, end]);

  const decline = async () => {
    await postJSON('/api/sandbox', { id: sb.id, action: 'decline' });
    onChanged();
  };

  const callsLeft = view.limits.callsLeft;
  const canCall = Boolean(inc && inc.status !== 'resolved' && callsLeft > 0);

  let body: React.ReactNode;
  if (mode === 'call' && session && rtm) {
    body = <CallView session={session} rtmClient={rtm} sandbox={sb} hints={def?.hints ?? []} maxSeconds={view.limits.maxCallSeconds} onEnd={end} />;
  } else if (mode === 'connecting') {
    body = (
      <Centered>
        <Loader2 className="h-9 w-9 animate-spin text-brand" aria-hidden />
        <p className="mt-4 text-[15px] font-medium text-ink">Connecting securely…</p>
        <p className="mt-1 text-[13px] text-dim">Agora real-time voice · Murf Falcon</p>
      </Centered>
    );
  } else if (!inc) {
    body = (
      <Centered>
        <span className="relative flex h-24 w-24 items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-brand/10 animate-ring-ripple" />
          <span className="relative flex h-20 w-20 items-center justify-center rounded-[1.6rem] bg-brand/10 ring-1 ring-brand/25">
            <LogoMark size={44} />
          </span>
        </span>
        <p className="mt-6 text-[19px] font-semibold tracking-tight text-ink">All quiet</p>
        <p className="mt-2 max-w-[260px] text-[13.5px] leading-relaxed text-dim">
          Vigil is watching Thali’s 8 services. When something breaks, it investigates first, then calls you with the fix.
        </p>
        <p className="mt-5 rounded-full bg-raised px-3 py-1.5 text-[12px] text-dim">On call: <span className="font-semibold text-ink">{sb.engineer}</span></p>
      </Centered>
    );
  } else if (call?.status === 'investigating') {
    const before = sb.actions.filter((a) => a.phase === 'before');
    const startedAt = call.ringAt ? Date.parse(call.ringAt) - INVESTIGATION_MS : now;
    const shown = Math.max(1, Math.min(before.length, Math.floor((now - startedAt) / 520) + 1));
    body = (
      <div className="flex h-full flex-col px-6 pt-8">
        <p className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-bad">
          <span className="h-2 w-2 rounded-full bg-bad animate-soft-pulse" /> {inc.severity} · {inc.id}
        </p>
        <p className="mt-3 text-[22px] font-semibold leading-tight tracking-tight text-ink">Vigil is investigating</p>
        <p className="mt-1 text-[13px] text-dim">Before it wakes anyone up.</p>
        <ol className="mt-6 space-y-3" data-testid="investigation">
          {before.slice(0, shown).map((a) => (
            <li key={a.id} className="flex gap-2.5 animate-fade-up">
              <Search className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
              <span className="text-[13.5px] leading-snug text-ink">{a.title}</span>
            </li>
          ))}
        </ol>
        <p className="mt-auto pb-8 text-center text-[13px] text-dim">
          <Loader2 className="mr-1.5 inline h-4 w-4 animate-spin" aria-hidden /> Calling {sb.engineer} with the diagnosis…
        </p>
      </div>
    );
  } else if (call?.status === 'ringing') {
    body = (
      <div className="flex h-full flex-col items-center justify-between px-6 py-10 text-center" data-testid="incoming-call">
        <div>
          <p className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-dim">
            <PhoneIncoming className="h-4 w-4" aria-hidden /> Incoming call{call.attempt > 1 ? ` · attempt ${call.attempt}` : ''}
          </p>
          <p className="mt-3 text-[34px] font-semibold tracking-tight text-ink">Vigil</p>
          <p className="mt-1 text-[14px] text-bad">
            {inc.severity} · {inc.id}
          </p>
          <p className="mx-auto mt-4 max-w-[270px] text-[14px] leading-relaxed text-dim">{def?.title}</p>
        </div>
        <span className="relative flex h-32 w-32 items-center justify-center text-brand">
          <span className="absolute inset-0 rounded-full bg-brand/20 animate-ring-ripple" />
          <span className="absolute inset-0 rounded-full bg-brand/20 animate-ring-ripple [animation-delay:0.9s]" />
          <span className="relative flex h-24 w-24 items-center justify-center rounded-full bg-surface ring-1 ring-brand/40">
            <LogoMark size={52} />
          </span>
        </span>
        <div className="flex w-full items-center justify-around">
          <button onClick={decline} className="flex flex-col items-center gap-2" data-testid="decline-call" aria-label="Decline the call">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-bad text-white shadow-lg shadow-bad/25 transition hover:brightness-110">
              <PhoneOff className="h-7 w-7" aria-hidden />
            </span>
            <span className="text-[13px] text-dim">Decline</span>
          </button>
          <button onClick={start} className="flex flex-col items-center gap-2" data-testid="answer-call" aria-label="Answer the call">
            <span className="flex h-16 w-16 animate-bounce items-center justify-center rounded-full bg-good text-canvas shadow-lg shadow-good/25 transition hover:brightness-110">
              <PhoneIcon className="h-7 w-7" aria-hidden />
            </span>
            <span className="text-[13px] font-semibold text-ink">Answer</span>
          </button>
        </div>
      </div>
    );
  } else {
    // missed, declined or ended
    const resolved = inc.status === 'resolved';
    const missed = call?.status === 'missed';
    const declined = call?.status === 'declined';
    body = (
      <Centered>
        {resolved ? (
          <CheckCircle2 className="h-12 w-12 text-good" aria-hidden />
        ) : missed || declined ? (
          <PhoneMissed className="h-12 w-12 text-bad" aria-hidden />
        ) : (
          <PhoneOff className="h-12 w-12 text-dim" aria-hidden />
        )}
        <p className="mt-5 text-[19px] font-semibold tracking-tight text-ink">
          {resolved ? `${inc.id} resolved` : missed ? 'Missed call from Vigil' : declined ? 'You declined' : 'Call ended'}
        </p>
        <p className="mt-2 max-w-[270px] text-[13.5px] leading-relaxed text-dim">
          {resolved
            ? 'The postmortem draft and follow-up tickets are ready.'
            : missed && call?.retryAt
              ? `Vigil will ring again at ${fmtClock(call.retryAt)}.`
              : sb.escalatedTo
                ? `Vigil paged the secondary on-call, ${sb.escalatedTo}, with the full diagnosis.`
                : inc.mitigatedAt
                  ? 'The fix is in. Vigil is still watching the metrics.'
                  : 'The incident is still open.'}
        </p>
        {resolved ? (
          <Link href={`/postmortem?s=${sb.id}`} target="_blank" className="mt-6 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[14px] font-semibold text-canvas transition hover:bg-white">
            Open the postmortem
          </Link>
        ) : (
          <button
            onClick={start}
            disabled={!canCall}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-good px-5 py-2.5 text-[14px] font-semibold text-canvas transition hover:brightness-110 disabled:opacity-40"
            data-testid="call-back"
          >
            <PhoneIcon className="h-4 w-4" aria-hidden /> Call Vigil back
          </button>
        )}
      </Centered>
    );
  }

  return (
    <div ref={frame} className="relative flex h-[660px] scroll-mt-[76px] flex-col overflow-hidden rounded-[2.25rem] border border-line/10 bg-gradient-to-b from-surface via-surface to-canvas shadow-[0_40px_120px_-40px_rgb(var(--brand)/0.35)]">
      <div className="flex items-center justify-between px-6 pt-3 text-[11px] font-medium text-dim">
        <span className="tabular">{fmtClock(now)}</span>
        <span className="h-5 w-20 rounded-full bg-canvas" aria-hidden />
        <span>{callsLeft > 0 ? `${callsLeft} demo call${callsLeft === 1 ? '' : 's'} left` : 'No demo calls left'}</span>
      </div>
      {error && (
        <p className="mx-5 mt-3 rounded-xl bg-bad/10 px-3 py-2 text-[12.5px] text-bad" role="alert" data-testid="call-error">
          {error}
        </p>
      )}
      <div className="min-h-0 flex-1">{body}</div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full flex-col items-center justify-center px-8 text-center">{children}</div>;
}
