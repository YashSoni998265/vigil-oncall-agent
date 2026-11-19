'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Loader2, PhoneCall } from 'lucide-react';
import { SCENARIOS } from '@/lib/sim';
import { LogoMark } from '@/components/brand/Logo';
import { useSandboxView } from './useSandboxView';

// A paged teammate joins the engineer's live incident call from any phone (same Agora channel).

const TeammateCall = dynamic(() => import('./TeammateCall'), { ssr: false });

export interface Join {
  appId: string;
  channel: string;
  uid: string;
  token: string;
  name: string;
}

export default function TeammateJoin({ id }: { id: string }) {
  const { view, missing } = useSandboxView(id, 3000);
  const [join, setJoin] = useState<Join | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const sb = view?.sandbox;
  const paged = sb?.call?.teammatePaged ?? null;
  const live = sb?.call?.status === 'active';

  const start = async () => {
    setLoading(true);
    setError(null);
    const res = await fetch('/api/teammate/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    const data = (await res.json().catch(() => ({}))) as Join & { error?: string };
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? 'Could not join the call.');
      return;
    }
    setJoin(data);
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas p-4">
      <div className="w-full max-w-sm rounded-[2rem] border border-line/10 bg-gradient-to-b from-surface to-canvas p-6 text-center shadow-2xl">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/12 ring-1 ring-brand/30">
          <LogoMark size={36} />
        </span>
        {missing ? (
          <p className="mt-6 text-dim">This incident sandbox doesn’t exist any more.</p>
        ) : join ? (
          <TeammateCall join={join} id={id} engineer={sb?.engineer ?? 'the on-call engineer'} onLeave={() => setJoin(null)} />
        ) : (
          <>
            <p className="mt-5 text-[12px] font-semibold uppercase tracking-[0.14em] text-bad">{sb?.incident ? `${sb.incident.severity} · ${sb.incident.id}` : 'Incident call'}</p>
            <p className="mt-2 text-[22px] font-semibold tracking-tight text-ink">{paged ? `${paged.name}, you’ve been paged` : 'Incident call'}</p>
            <p className="mt-2 text-[14px] leading-relaxed text-dim">
              {sb?.incident ? SCENARIOS[sb.incident.scenario].title : 'Waiting for the incident…'}
              {sb ? `. ${sb.engineer} and Vigil are on the call.` : ''}
            </p>
            {error && <p className="mt-4 rounded-xl bg-bad/10 px-3 py-2 text-[13px] text-bad">{error}</p>}
            <button
              onClick={start}
              disabled={!paged || !live || loading}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-good px-5 py-3.5 text-[15px] font-semibold text-canvas transition hover:brightness-110 disabled:opacity-40"
              data-testid="join-call"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <PhoneCall className="h-5 w-5" />} Join the call
            </button>
            {!live && <p className="mt-3 text-[12px] text-faint">The call isn’t live right now.</p>}
            {live && !paged && <p className="mt-3 text-[12px] text-faint">Ask Vigil on the call to add a teammate first.</p>}
          </>
        )}
      </div>
    </div>
  );
}

