'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, Pencil, RotateCcw, WifiOff, Zap } from 'lucide-react';
import { IDLE_METRICS, SCENARIOS, fmtClock, fmtDuration } from '@/lib/sim';
import type { Incident, Sandbox, ScenarioId } from '@/lib/types';
import { postJSON, useNow, useSandbox, useSandboxId } from '@/lib/use-sandbox';
import Logo from '@/components/brand/Logo';
import { ImpactCard, MetricCard } from './Charts';
import { ScenarioPicker, ServiceMap, SideTabs, Timeline } from './Panels';
import Phone from './Phone';

export default function Console() {
  const { id, error, fresh } = useSandboxId();
  const { view, offline, refresh, serverNow } = useSandbox(id);
  const now = useNow(serverNow, 1000);
  const audioRef = useRef<AudioContext | null>(null);
  const [busy, setBusy] = useState<ScenarioId | null>(null);
  const [picker, setPicker] = useState(false);

  const unlockAudio = () => {
    try {
      audioRef.current = audioRef.current ?? new AudioContext();
      void audioRef.current.resume();
    } catch {}
  };

  const trigger = useCallback(
    async (scenario: ScenarioId) => {
      if (!id) return;
      unlockAudio();
      setBusy(scenario);
      await postJSON('/api/sandbox', { id, action: 'trigger', scenario });
      await refresh();
      setBusy(null);
      setPicker(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [id, refresh],
  );

  const reset = useCallback(async () => {
    if (!id) return;
    await postJSON('/api/sandbox', { id, action: 'reset' });
    await refresh();
    setPicker(false);
  }, [id, refresh]);

  if (error) {
    return (
      <Shell>
        <div className="mx-auto mt-24 max-w-md text-center">
          <p className="text-lg font-semibold">Couldn’t open your sandbox</p>
          <p className="mt-2 text-dim">{error}</p>
          <button onClick={fresh} className="mt-6 rounded-full bg-ink px-5 py-2.5 font-semibold text-canvas">
            Try again
          </button>
        </div>
      </Shell>
    );
  }
  if (!view) {
    return (
      <Shell>
        <div className="mx-auto mt-32 flex max-w-md flex-col items-center text-center text-dim">
          <span className="h-10 w-10 animate-spin rounded-full border-2 border-line/10 border-t-brand" />
          <p className="mt-5 text-sm">Spinning up your private copy of Thali’s production…</p>
        </div>
      </Shell>
    );
  }

  const sb = view.sandbox;
  const inc = sb.incident;
  const def = inc ? SCENARIOS[inc.scenario] : null;
  const metrics = def ? def.metrics : IDLE_METRICS;
  const callLive = Boolean(sb.call && ['ringing', 'active', 'investigating'].includes(sb.call.status));

  return (
    <Shell>
      <TopBar sandbox={sb} now={now} onReset={reset} onRenamed={refresh} />
      {offline && (
        <p className="mx-auto mt-3 flex max-w-[1500px] items-center gap-2 px-4 text-[13px] text-warn sm:px-6">
          <WifiOff className="h-4 w-4" aria-hidden /> Connection lost. Retrying…
        </p>
      )}
      <main className="mx-auto grid max-w-[1500px] gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-6 lg:py-6">
        <div className="flex min-w-0 flex-col gap-5">
          {!inc || picker ? (
            <section className="panel relative overflow-hidden p-5 sm:p-7" aria-labelledby="break-title">
              <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-bad/10 blur-3xl" />
              <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-bad">Your private sandbox</p>
              <h1 id="break-title" className="mt-2 text-[clamp(1.8rem,3.4vw,2.6rem)] font-semibold leading-[1.05] tracking-tightest text-ink">
                Break production. <span className="text-dim">Safely.</span>
              </h1>
              <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-dim">
                Pick an incident. Vigil investigates first, then your phone rings. Talk to it, or type, and approve the fix. Nothing real is harmed: this is your own copy of Thali, a food-delivery app.
              </p>
              <div className="mt-6">
                <ScenarioPicker onPick={trigger} busy={busy} />
              </div>
              {inc && (
                <button onClick={() => setPicker(false)} className="mt-4 text-[13px] text-dim underline-offset-4 hover:underline">
                  Back to {inc.id}
                </button>
              )}
            </section>
          ) : (
            <IncidentHeader incident={inc} sandbox={sb} now={now} onBreakAnother={() => setPicker(true)} />
          )}

          <div className={`grid gap-4 sm:grid-cols-2 ${callLive ? 'order-2 lg:order-none' : ''}`}>
            {metrics.map((m) => (
              <MetricCard key={m.id} def={m} incident={inc} seed={sb.id} now={now} markers={markersFor(inc, m.id)} />
            ))}
            <ImpactCard scenario={def} incident={inc} now={now} />
          </div>

          <div className={callLive ? 'order-3 lg:order-none' : ''}>
            <ServiceMap incident={inc} now={now} />
          </div>
          <div className={callLive ? 'order-4 lg:order-none' : ''}>
            <Timeline actions={sb.actions} />
          </div>
        </div>

        {/* On laptops the phone plus the tabs are taller than the screen, so the column scrolls on its own
            (otherwise the tabs were only reachable at the very end of the page). The -mx/px pair keeps the
            column 400px wide while leaving room for the phone's glow inside the scroll box (the mask fades
            the glow out at the right edge instead of cutting it on wide screens), and shrink-0 stops
            flexbox squeezing the phone and the tabs to fit instead of scrolling. */}
        <aside
          className={`scroll-quiet flex flex-col gap-5 [&>*]:shrink-0 lg:sticky lg:top-[76px] lg:-mx-6 lg:max-h-[calc(100dvh-92px)] lg:self-start lg:overflow-y-auto lg:px-6 lg:[mask-image:linear-gradient(to_right,#000_calc(100%_-_24px),transparent)] ${callLive ? 'order-first lg:order-none' : ''}`}
        >
          <Phone view={view} now={now} audioRef={audioRef} onChanged={refresh} />
          <SideTabs sandbox={sb} />
        </aside>
      </main>
      <footer className="mx-auto max-w-[1500px] px-4 pb-10 text-[12px] text-faint sm:px-6">
        Real Agora Conversational AI and Murf Falcon voice; Thali’s production is simulated so anyone can safely break it. Sandbox {sb.id}.
      </footer>
    </Shell>
  );
}

function markersFor(inc: Incident | null, _metricId: string) {
  if (!inc) return [];
  const def = SCENARIOS[inc.scenario];
  const fault = Date.parse(inc.faultAt);
  const marks: { t: number; label: string; tone: 'neutral' | 'good' }[] = [{ t: fault + def.marker.offsetMs, label: def.marker.label, tone: 'neutral' }];
  for (const r of inc.remediations) {
    if (r.outcome === 'failed') marks.push({ t: Date.parse(r.at), label: `${r.action.split('_')[0]} blocked`, tone: 'neutral' });
  }
  if (inc.mitigatedAt) marks.push({ t: Date.parse(inc.mitigatedAt), label: 'fix', tone: 'good' });
  return marks;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-canvas text-ink">{children}</div>;
}

const STATUS_LABEL: Record<Incident['status'], string> = {
  investigating: 'Investigating',
  identified: 'Diagnosed',
  mitigating: 'Fix applied',
  monitoring: 'Recovered',
  resolved: 'Resolved',
};

function TopBar({ sandbox, now, onReset, onRenamed }: { sandbox: Sandbox; now: number; onReset: () => void; onRenamed: () => void }) {
  const inc = sandbox.incident;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(sandbox.engineer);
  const save = async () => {
    setEditing(false);
    if (name.trim() && name.trim() !== sandbox.engineer) {
      await postJSON('/api/sandbox', { id: sandbox.id, action: 'set_name', name });
      onRenamed();
    }
  };
  const tone = !inc || inc.status === 'resolved' || inc.status === 'monitoring' ? 'good' : inc.status === 'mitigating' ? 'warn' : 'bad';
  return (
    <header className="glass sticky top-0 z-30 border-x-0 border-t-0">
      <div className="mx-auto flex h-[60px] max-w-[1500px] items-center gap-3 px-4 sm:px-6">
        <Link href="/" aria-label="Vigil home">
          <Logo />
        </Link>
        <span className="hidden text-faint md:inline">/</span>
        <span className="hidden text-[13px] text-dim md:inline">
          Thali · production <span className="ml-1 rounded-full bg-raised px-2 py-0.5 text-[11px] text-faint">private sandbox</span>
        </span>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <span
            data-testid="health-pill"
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium ${
              tone === 'good' ? 'bg-good/12 text-good' : tone === 'warn' ? 'bg-warn/12 text-warn' : 'bg-bad/12 text-bad'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${tone === 'good' ? 'bg-good' : tone === 'warn' ? 'bg-warn' : 'bg-bad animate-soft-pulse'}`} />
            {!inc ? 'All systems normal' : `${inc.id} · ${STATUS_LABEL[inc.status]}`}
          </span>
          <span className="hidden font-mono text-[12px] text-dim tabular sm:inline">{fmtClock(now)} IST</span>
          <span className="hidden items-center gap-1.5 text-[12px] text-dim lg:inline-flex">
            On call:
            {editing ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void save();
                }}
                className="inline-flex items-center gap-1"
              >
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={save}
                  maxLength={24}
                  className="w-24 rounded-md border border-line/15 bg-canvas px-1.5 py-0.5 text-ink focus:border-brand focus:outline-none"
                  aria-label="Your name"
                />
                <button type="submit" aria-label="Save name">
                  <Check className="h-3.5 w-3.5 text-good" />
                </button>
              </form>
            ) : (
              <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1 font-semibold text-ink hover:text-brand" aria-label="Change the on-call engineer's name">
                {sandbox.engineer} <Pencil className="h-3 w-3 text-faint" />
              </button>
            )}
            <LanguageToggle sandbox={sandbox} onChanged={onRenamed} />
          </span>
          <button
            onClick={onReset}
            className="inline-flex items-center gap-1.5 rounded-full border border-line/10 px-3 py-1.5 text-[12px] font-medium text-dim transition hover:border-line/25 hover:text-ink"
            data-testid="reset"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden /> <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>
    </header>
  );
}

const LANGUAGES = [
  { id: 'en', label: 'English' },
  { id: 'hi', label: 'हिंदी' },
] as const;

/** Hindi mode: the next call hears Hindi and Vigil answers in Hinglish. Locked while a call is live. */
function LanguageToggle({ sandbox, onChanged }: { sandbox: Sandbox; onChanged: () => void | Promise<void> }) {
  const [pending, setPending] = useState<'en' | 'hi' | null>(null);
  const current = pending ?? sandbox.language ?? 'en';
  const locked = sandbox.call?.status === 'active';
  const choose = async (language: 'en' | 'hi') => {
    if (locked || pending || language === current) return;
    setPending(language);
    await postJSON('/api/sandbox', { id: sandbox.id, action: 'set_language', language }).catch(() => null);
    await onChanged();
    setPending(null);
  };
  return (
    <span
      data-testid="language-toggle"
      role="group"
      aria-label="Call language"
      title={locked ? 'Applies to the next call' : 'The language you speak to Vigil. In Hindi, Vigil answers in Hinglish.'}
      className={`ml-1 inline-flex items-center rounded-full border border-line/10 p-0.5 ${locked ? 'opacity-50' : ''}`}
    >
      {LANGUAGES.map((l) => (
        <button
          key={l.id}
          type="button"
          lang={l.id}
          aria-pressed={current === l.id}
          disabled={locked}
          onClick={() => void choose(l.id)}
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium transition disabled:pointer-events-none ${
            current === l.id ? 'bg-raised text-ink' : 'text-faint hover:text-ink'
          }`}
        >
          {l.label}
        </button>
      ))}
    </span>
  );
}

function IncidentHeader({ incident, sandbox, now, onBreakAnother }: { incident: Incident; sandbox: Sandbox; now: number; onBreakAnother: () => void }) {
  const def = SCENARIOS[incident.scenario];
  const answered = sandbox.actions.find((a) => a.tool === 'call' && /answered|called Vigil back/.test(a.title));
  const steps = useMemo(
    () => [
      { label: 'Detected', at: incident.alertAt },
      { label: 'Diagnosed', at: sandbox.actions.find((a) => a.tool === 'diagnosis')?.at ?? null },
      { label: 'On the call', at: answered?.at ?? null },
      { label: 'Fixed', at: incident.mitigatedAt },
      { label: 'Verified', at: incident.recoveredAt },
      { label: 'Resolved', at: incident.resolvedAt },
    ],
    [incident, sandbox.actions, answered],
  );
  const fault = Date.parse(incident.faultAt);
  const alert = Date.parse(incident.alertAt);
  const end = incident.resolvedAt ? Date.parse(incident.resolvedAt) : now;
  const ttm = incident.mitigatedAt ? Date.parse(incident.mitigatedAt) - alert : null;
  const tone = incident.status === 'resolved' || incident.status === 'monitoring' ? 'good' : incident.status === 'mitigating' ? 'warn' : 'bad';

  return (
    <section className="panel relative overflow-hidden p-5 sm:p-6" aria-labelledby="incident-title">
      <div className={`pointer-events-none absolute -left-20 -top-28 h-64 w-64 rounded-full blur-3xl ${tone === 'bad' ? 'bg-bad/12' : tone === 'warn' ? 'bg-warn/10' : 'bg-good/10'}`} />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-[12px] font-semibold">
            <span className={`rounded-md px-2 py-0.5 ${tone === 'bad' ? 'bg-bad text-white' : tone === 'warn' ? 'bg-warn text-canvas' : 'bg-good text-canvas'}`}>{incident.severity}</span>
            <span className="font-mono text-dim">{incident.id}</span>
            <span className="text-faint">·</span>
            <span className="text-dim">errors began {fmtClock(incident.faultAt)}</span>
          </p>
          <h1 id="incident-title" className="mt-2 text-[clamp(1.35rem,2.4vw,1.85rem)] font-semibold leading-tight tracking-tight text-ink">
            {def.title}
          </h1>
        </div>
        <div className="flex items-center gap-5 text-right">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-faint">{incident.resolvedAt ? 'Duration' : 'Open for'}</p>
            <p className="font-mono text-[20px] font-semibold text-ink tabular">{fmtDuration(end - fault)}</p>
          </div>
          {ttm !== null && (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-faint">Alert → fix</p>
              <p className="font-mono text-[20px] font-semibold text-good tabular">{fmtDuration(ttm)}</p>
            </div>
          )}
        </div>
      </div>
      <ol className="relative mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="Incident progress">
        {steps.map((s, i) => {
          const done = Boolean(s.at);
          const current = !done && (i === 0 || Boolean(steps[i - 1].at));
          return (
            <li key={s.label} className={`rounded-xl border px-3 py-2 ${done ? 'border-good/25 bg-good/[0.06]' : current ? 'border-brand/40 bg-brand/[0.08]' : 'border-line/10'}`}>
              <p className={`flex items-center gap-1.5 text-[12px] font-semibold ${done ? 'text-good' : current ? 'text-ink' : 'text-faint'}`}>
                {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : current ? <Zap className="h-3.5 w-3.5 text-brand" aria-hidden /> : <span className="h-3.5 w-3.5" />}
                {s.label}
              </p>
              <p className="mt-0.5 font-mono text-[10.5px] text-faint tabular">{s.at ? fmtClock(s.at) : current ? 'now' : '—'}</p>
            </li>
          );
        })}
      </ol>
      <div className="relative mt-4 flex flex-wrap items-center justify-between gap-3 text-[13px]">
        <p className="text-dim">
          Recommended by Vigil: <span className="font-medium text-ink">{incident.recommended ?? def.recommended}</span>
          {incident.learnedFrom ? <span className="ml-1.5 text-good">· worked in {incident.learnedFrom.id}</span> : null}
        </p>
        <button onClick={onBreakAnother} className="text-[13px] font-medium text-dim underline-offset-4 hover:text-ink hover:underline">
          Break something else
        </button>
      </div>
    </section>
  );
}
