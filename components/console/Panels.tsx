'use client';

import { useEffect, useRef, useState } from 'react';
import { diagnosis } from '@/lib/server/diagnosis';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  Bell,
  CheckCircle2,
  CircleSlash,
  CreditCard,
  Database,
  ExternalLink,
  FileText,
  Hash,
  Keyboard,
  ListChecks,
  Megaphone,
  Mic,
  Rocket,
  Search,
  ShieldAlert,
  Wrench,
  XCircle,
} from 'lucide-react';
import { SCENARIOS, SCENARIO_ORDER, SERVICES, fmtClock, fmtClockSeconds, fmtDuration, fmtINR, fmtInt, impactAt, incidentFactor } from '@/lib/sim';
import type { ActionEntry, ChannelMessage, Incident, Sandbox, ScenarioId } from '@/lib/types';

// ---------------------------------------------------------------------------
// Incident picker

const SCENARIO_ICON: Record<ScenarioId, typeof Rocket> = {
  bad_deploy: Rocket,
  upi_provider: CreditCard,
  db_overload: Database,
};

export function ScenarioPicker({ onPick, busy, compact = false }: { onPick: (s: ScenarioId) => void; busy: ScenarioId | null; compact?: boolean }) {
  return (
    <div className={`grid gap-3 ${compact ? 'sm:grid-cols-3' : 'md:grid-cols-3'}`}>
      {SCENARIO_ORDER.map((id) => {
        const s = SCENARIOS[id];
        const Icon = SCENARIO_ICON[id];
        return (
          <button
            key={id}
            onClick={() => onPick(id)}
            disabled={busy !== null}
            data-testid={`break-${id}`}
            className="group relative flex flex-col items-start gap-3 overflow-hidden rounded-2xl border border-line/10 bg-surface p-5 text-left transition hover:-translate-y-0.5 hover:border-bad/40 hover:bg-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-wait disabled:opacity-60"
          >
            <span className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-bad/0 blur-2xl transition group-hover:bg-bad/15" />
            <span className="flex w-full items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-raised text-ink ring-1 ring-line/10">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="rounded-full bg-raised px-2.5 py-1 text-[11px] font-medium text-dim">{s.difficulty}</span>
            </span>
            <span>
              <span className="block text-[17px] font-semibold tracking-tight text-ink">{s.name}</span>
              {!compact && <span className="mt-1 block text-sm leading-relaxed text-dim">{s.tagline}</span>}
            </span>
            <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-bad">
              {busy === id ? 'Breaking…' : 'Break it'} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Service map

type Health = 'healthy' | 'degraded' | 'down';

function serviceHealth(incident: Incident | null, service: string, now: number): Health {
  if (!incident || incident.status === 'resolved') return 'healthy';
  const def = SCENARIOS[incident.scenario];
  const f = incidentFactor(incident, now);
  if (incident.scenario === 'upi_provider' && incident.mitigatedAt && service === 'paynova') return 'degraded';
  if (f < 0.1) return 'healthy';
  if (def.impacted.includes(service)) return f > 0.5 ? 'down' : 'degraded';
  if (def.degraded.includes(service)) return 'degraded';
  return 'healthy';
}

const HEALTH_STYLE: Record<Health, string> = {
  healthy: 'border-line/10 text-ink',
  degraded: 'border-warn/40 text-ink bg-warn/[0.06]',
  down: 'border-bad/50 text-ink bg-bad/[0.08]',
};
const HEALTH_DOT: Record<Health, string> = { healthy: 'bg-good', degraded: 'bg-warn', down: 'bg-bad animate-soft-pulse' };

export function ServiceMap({ incident, now }: { incident: Incident | null; now: number }) {
  // Where the failure starts, traced down the dependency chain before the call.
  const dx = incident && incident.status !== 'resolved' ? diagnosis(incident.scenario) : null;
  const node = (id: string) => {
    const svc = SERVICES.find((s) => s.id === id)!;
    const h = serviceHealth(incident, id, now);
    const root = dx?.rootNode === id && h !== 'healthy';
    return (
      <div
        key={id}
        className={`flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2 font-mono text-[12px] transition-colors ${HEALTH_STYLE[h]} ${root ? 'ring-2 ring-bad/60' : ''}`}
        title={`${svc.label}: ${h}${root ? ' (root cause)' : ''}`}
        data-testid={root ? 'root-cause-node' : undefined}
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${HEALTH_DOT[h]}`} aria-hidden />
        <span className="truncate">{svc.label}</span>
        {root && <span className="ml-auto shrink-0 rounded-md bg-bad/15 px-1.5 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wide text-bad">root cause</span>}
        <span className="sr-only">{h}</span>
      </div>
    );
  };
  const arrow = <span className="hidden text-faint sm:inline" aria-hidden>→</span>;
  return (
    <section className="panel p-4 sm:p-5">
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-[13px] font-medium text-dim">Service map</h2>
        <span className="flex items-center gap-3 text-[11px] text-faint">
          <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-good" />healthy</span>
          <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-warn" />degraded</span>
          <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-bad" />down</span>
        </span>
      </header>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] sm:items-center">
        {node('web-app')}
        {arrow}
        {node('api-gateway')}
        {arrow}
        {node('checkout-api')}
        {arrow}
        {node('payments-service')}
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-4">
        {node('orders-db')}
        {node('coupon-engine')}
        {node('paynova')}
        {node('cashly')}
      </div>
      {dx && (
        <p className="mt-3 text-[11.5px] leading-relaxed text-dim" data-testid="traced-path">
          Traced: <span className="font-mono text-ink">{dx.path.join(' → ')}</span> · ruled out {dx.ruledOut.length} other suspects
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// What Vigil did

const KIND: Record<ActionEntry['kind'], { icon: typeof Search; cls: string; label: string }> = {
  read: { icon: Search, cls: 'text-dim bg-raised', label: 'Read' },
  change: { icon: Wrench, cls: 'text-good bg-good/12', label: 'Changed production' },
  blocked: { icon: ShieldAlert, cls: 'text-warn bg-warn/12', label: 'Blocked' },
  failed: { icon: XCircle, cls: 'text-bad bg-bad/12', label: 'Failed' },
  comms: { icon: Megaphone, cls: 'text-sky bg-sky/12', label: 'Communicated' },
  system: { icon: Activity, cls: 'text-faint bg-raised', label: 'Event' },
};
const PHASE_LABEL: Record<ActionEntry['phase'], string> = {
  before: 'Before the call: investigation',
  call: 'On the call',
  after: 'After the call',
};

export function Timeline({ actions }: { actions: ActionEntry[] }) {
  const groups: { phase: ActionEntry['phase']; items: ActionEntry[] }[] = [];
  for (const a of actions) {
    const last = groups[groups.length - 1];
    if (last && last.phase === a.phase) last.items.push(a);
    else groups.push({ phase: a.phase, items: [a] });
  }
  return (
    <section className="panel p-4 sm:p-5" aria-labelledby="timeline-title">
      <header className="mb-4 flex items-center justify-between">
        <h2 id="timeline-title" className="text-[13px] font-medium text-dim">What Vigil did</h2>
        <span className="text-[11px] text-faint">{actions.length} steps · every tool call, approval and refusal</span>
      </header>
      {actions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line/10 px-4 py-6 text-center text-sm text-faint">
          Nothing yet. Break production and watch Vigil investigate before it calls you.
        </p>
      ) : (
        <ol className="space-y-5" data-testid="timeline">
          {groups.map((g, gi) => (
            <li key={`${g.phase}-${gi}`}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">{PHASE_LABEL[g.phase]}</p>
              <ol className="relative space-y-2.5 border-l border-line/10 pl-5">
                {g.items.map((a) => {
                  const k = KIND[a.kind];
                  const Icon = k.icon;
                  return (
                    <li key={a.id} className="relative animate-fade-up" data-kind={a.kind}>
                      <span className={`absolute -left-[30px] top-0 flex h-[19px] w-[19px] items-center justify-center rounded-full ring-4 ring-surface ${k.cls}`} title={k.label}>
                        <Icon className="h-3 w-3" aria-hidden />
                      </span>
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-mono text-[11px] text-faint tabular">{fmtClockSeconds(a.at)}</span>
                        <span className="text-[13.5px] font-medium leading-snug text-ink">{a.title}</span>
                      </div>
                      {a.detail && <p className="mt-0.5 text-[12.5px] leading-relaxed text-dim [overflow-wrap:anywhere]">{a.detail}</p>}
                      {a.approval && (
                        <p className="mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-full bg-good/10 px-2.5 py-1 text-[11.5px] text-good">
                          <Mic className="h-3 w-3 shrink-0" aria-hidden />
                          <span className="truncate">Approved by voice: “{a.approval}”</span>
                        </p>
                      )}
                    </li>
                  );
                })}
              </ol>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Side tabs: incident channel, status page, follow-ups, postmortem

type Tab = 'channel' | 'status' | 'tickets' | 'postmortem';

export function SideTabs({ sandbox }: { sandbox: Sandbox }) {
  const [tab, setTab] = useState<Tab>('channel');
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Each tab opens at its top; the channel scrolls itself to the newest message.
    if (tab !== 'channel' && panel.current) panel.current.scrollTop = 0;
  }, [tab]);
  const inc = sandbox.incident;
  const tabs: { id: Tab; label: string; icon: typeof Hash; count?: number }[] = [
    { id: 'channel', label: 'Channel', icon: Hash, count: sandbox.channel.length },
    { id: 'status', label: 'Status', icon: Bell, count: inc?.statusUpdates.length },
    { id: 'tickets', label: 'Tickets', icon: ListChecks, count: inc?.followUps.length },
    { id: 'postmortem', label: 'Postmortem', icon: FileText },
  ];
  const select = (id: Tab, el: HTMLElement) => {
    setTab(id);
    // If the bar ever overflows (browser zoom), keep the chosen tab fully in view.
    // Only the bar scrolls: scrollIntoView would also move the page.
    const bar = el.parentElement;
    if (!bar) return;
    const a = el.getBoundingClientRect();
    const b = bar.getBoundingClientRect();
    if (a.left < b.left) bar.scrollLeft -= b.left - a.left;
    else if (a.right > b.right) bar.scrollLeft += a.right - b.right;
  };
  return (
    <section className="panel overflow-hidden">
      {/* All four tabs fit the 400px side column with room for two-digit counts; past that the bar scrolls instead of clipping. */}
      <div className="scroll-quiet flex overflow-x-auto border-b border-line/10" role="tablist" aria-label="Incident outputs">
        {tabs.map((t) => {
          const Icon = t.icon;
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={on}
              onClick={(e) => select(t.id, e.currentTarget)}
              className={`flex flex-1 items-center justify-center gap-1 whitespace-nowrap px-1.5 py-3 text-[12px] font-medium transition ${on ? 'bg-raised text-ink' : 'text-faint hover:text-dim'}`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="hidden sm:inline">{t.label}</span>
              {t.count ? <span className={`rounded-full px-1 text-[10px] tabular ${on ? 'bg-brand/25 text-ink' : 'bg-raised text-dim'}`}>{t.count}</span> : null}
            </button>
          );
        })}
      </div>
      <div ref={panel} className="max-h-[380px] min-h-[220px] overflow-y-auto p-4 scroll-quiet" role="tabpanel">
        {tab === 'channel' && <Channel messages={sandbox.channel} name={inc ? `#${inc.id.toLowerCase()}` : '#incidents'} />}
        {tab === 'status' && <StatusPreview sandbox={sandbox} />}
        {tab === 'tickets' && <Tickets incident={inc} />}
        {tab === 'postmortem' && <PostmortemPreview sandbox={sandbox} />}
      </div>
    </section>
  );
}

function Channel({ messages, name }: { messages: ChannelMessage[]; name: string }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Scroll the panel, never the page (scrollIntoView would move the whole window).
    const panel = end.current?.closest('[role=tabpanel]');
    if (panel) panel.scrollTop = panel.scrollHeight;
  }, [messages.length]);
  if (!messages.length) return <Empty text="The incident channel opens when an alert fires." />;
  return (
    <div className="space-y-3" data-testid="channel">
      <p className="text-[11px] font-semibold text-faint">{name}</p>
      {messages.map((m) => (
        <div key={m.id} className="flex gap-2.5 animate-fade-up">
          <span
            className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold ${
              m.role === 'vigil' ? 'bg-brand/20 text-brand' : m.role === 'bot' ? 'bg-bad/15 text-bad' : 'bg-raised text-ink'
            }`}
            aria-hidden
          >
            {m.author[0]}
          </span>
          <div className="min-w-0">
            <p className="text-[12px]">
              <span className="font-semibold text-ink">{m.author}</span>
              <span className="ml-2 font-mono text-[10.5px] text-faint">{fmtClock(m.at)}</span>
            </p>
            <p className="text-[13px] leading-relaxed text-dim [overflow-wrap:anywhere]">{m.text}</p>
          </div>
        </div>
      ))}
      <div ref={end} />
    </div>
  );
}

function StatusPreview({ sandbox }: { sandbox: Sandbox }) {
  const inc = sandbox.incident;
  const updates = inc?.statusUpdates ?? [];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-dim">What customers see on Thali’s public status page</p>
        <Link href={`/status?s=${sandbox.id}`} target="_blank" className="inline-flex items-center gap-1 text-[12px] font-medium text-brand hover:underline">
          Open <ExternalLink className="h-3 w-3" aria-hidden />
        </Link>
      </div>
      {updates.length === 0 ? (
        <Empty text={inc ? 'No public update yet. Ask Vigil to update the status page.' : 'All systems operational.'} />
      ) : (
        [...updates].reverse().map((u, i) => (
          <div key={i} className="rounded-xl border border-line/10 bg-raised/40 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">
              {u.status} · {fmtClock(u.at)}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink">{u.text}</p>
          </div>
        ))
      )}
    </div>
  );
}

function Tickets({ incident }: { incident: Incident | null }) {
  if (!incident?.followUps.length) return <Empty text="Follow-up tickets with owners appear here." />;
  return (
    <ul className="space-y-2">
      {incident.followUps.map((f) => (
        <li key={f.key} className="flex items-start gap-3 rounded-xl border border-line/10 bg-raised/40 p-3">
          <span className={`mt-0.5 rounded-md px-1.5 py-0.5 font-mono text-[10.5px] font-semibold ${f.priority === 'P1' ? 'bg-bad/15 text-bad' : f.priority === 'P2' ? 'bg-warn/15 text-warn' : 'bg-raised text-dim'}`}>{f.priority}</span>
          <div className="min-w-0">
            <p className="text-[13px] font-medium leading-snug text-ink">{f.title}</p>
            <p className="mt-0.5 font-mono text-[11px] text-faint">
              {f.key} · {f.owner}
              {f.url && (
                <a href={f.url} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-0.5 text-sky hover:underline">
                  GitHub issue <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              )}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function PostmortemPreview({ sandbox }: { sandbox: Sandbox }) {
  const inc = sandbox.incident;
  if (!inc || inc.status !== 'resolved' || !inc.resolvedAt) return <Empty text="Vigil drafts the postmortem when you resolve the incident." />;
  // The same numbers as the full postmortem, so the essentials are readable without leaving the console.
  const resolved = Date.parse(inc.resolvedAt);
  const impact = impactAt(SCENARIOS[inc.scenario], inc, resolved);
  const approvals = sandbox.actions.filter((a) => a.approval).length;
  const stats: [string, string][] = [
    ['Duration', fmtDuration(resolved - Date.parse(inc.faultAt))],
    ['Alert → fix', inc.mitigatedAt ? fmtDuration(Date.parse(inc.mitigatedAt) - Date.parse(inc.alertAt)) : '—'],
    ['Failed orders', fmtInt(impact.failedOrders)],
    ['Revenue impact', fmtINR(impact.inr)],
  ];
  return (
    <div className="space-y-3" data-testid="postmortem-preview">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-good/12 px-2.5 py-1 text-[12px] font-medium text-good">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> {inc.id} resolved
        </p>
        <Link
          href={`/postmortem?s=${sandbox.id}`}
          target="_blank"
          className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-canvas transition hover:bg-white"
          data-testid="open-postmortem"
        >
          Open the full postmortem <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
      <dl className="grid grid-cols-2 gap-2">
        {stats.map(([k, v]) => (
          <div key={k} className="rounded-xl border border-line/10 bg-raised/40 px-3 py-2">
            <dt className="text-[10.5px] font-semibold uppercase tracking-wide text-faint">{k}</dt>
            <dd className="mt-0.5 text-[15px] font-semibold tabular text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      <div>
        <p className="text-[10.5px] font-semibold uppercase tracking-wide text-faint">Root cause</p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-dim">{inc.rootCause}</p>
      </div>
      {inc.summary && (
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-wide text-faint">What fixed it</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-dim">{inc.summary}</p>
        </div>
      )}
      <p className="text-[12px] text-faint">
        {inc.followUps.length} follow-up {inc.followUps.length === 1 ? 'ticket' : 'tickets'} · {approvals} approved {approvals === 1 ? 'change' : 'changes'} · the full timeline is in the postmortem
      </p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-2 rounded-xl border border-dashed border-line/10 px-3 py-5 text-[13px] text-faint">
      <CircleSlash className="h-4 w-4 shrink-0" aria-hidden /> {text}
    </p>
  );
}

export const TypedIcon = Keyboard;
