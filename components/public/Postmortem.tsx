'use client';

import { Download, Printer } from 'lucide-react';
import { SCENARIOS, fmtClock, fmtDuration, fmtINR, fmtInt, impactAt } from '@/lib/sim';
import type { Sandbox } from '@/lib/types';
import { useSandboxView } from './useSandboxView';
import { insights } from '@/lib/server/insights';

// The postmortem Vigil drafts when an incident is resolved. Blameless, printable.

const LESSONS: Record<string, { well: string[]; worse: string[] }> = {
  bad_deploy: {
    well: ['The rollback was refused by the deploy guard before it could make things worse.', 'Switching off the feature flag restored checkout without a new deploy.'],
    worse: ['The new coupon engine went to 100% of traffic with no canary.', 'Migration 0087 was not backward compatible, so the release could not be rolled back.'],
  },
  upi_provider: {
    well: ['Our own changes were ruled out quickly, so nobody rolled back healthy code.', 'The backup UPI provider had capacity for all traffic.'],
    worse: ['Failover was manual; it should happen automatically when provider success drops.'],
  },
  db_overload: {
    well: ['The database was not restarted, which would have caused a full outage.', 'A prompt-injection attempt in a support ticket was treated as data and ignored.'],
    worse: ['A weekly batch job ran a full table scan on the primary during peak hours.', 'Batch roles had no statement timeout.'],
  },
};

export default function Postmortem({ id }: { id: string }) {
  const { view, missing } = useSandboxView(id, 10_000);
  const sb = view?.sandbox;
  const inc = sb?.incident;

  return (
    <div className="min-h-dvh bg-white text-slate-900" style={{ colorScheme: 'light' }}>
      <div className="mx-auto max-w-3xl px-5 py-10 sm:py-14 print:py-0">
        {sb && inc && sb.transcript.length > 0 && (
          <div className="mb-6 flex justify-end print:hidden">
            <button
              type="button"
              onClick={() => downloadTranscript(sb)}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
              data-testid="download-transcript"
            >
              <Download className="h-4 w-4" /> Download call transcript
            </button>
          </div>
        )}
        {missing || (view && !inc) ? (
          <p className="text-slate-600">There is no incident in this sandbox yet. Break production in the console first.</p>
        ) : !view || !sb || !inc ? (
          <p className="text-slate-500">Loading…</p>
        ) : inc.status !== 'resolved' ? (
          <p className="text-slate-600">{inc.id} is still open. Vigil drafts the postmortem when the incident is resolved.</p>
        ) : (
          <Doc sb={sb} />
        )}
      </div>
    </div>
  );
}

function Doc({ sb }: { sb: Sandbox }) {
  const inc = sb.incident!;
  const def = SCENARIOS[inc.scenario];
  const fault = Date.parse(inc.faultAt);
  const alert = Date.parse(inc.alertAt);
  const resolved = Date.parse(inc.resolvedAt!);
  const impact = impactAt(def, inc, resolved);
  const lessons = LESSONS[inc.scenario];
  const approvals = sb.actions.filter((a) => a.approval);
  const ins = insights(inc.scenario);
  const timeline = sb.actions.filter((a) => a.kind !== 'read' || a.phase === 'before');

  return (
    <article className="text-[15px] leading-relaxed" data-testid="postmortem">
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <p className="text-sm font-semibold text-slate-500">Postmortem · blameless · drafted by Vigil</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            {inc.id}: {def.title}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {inc.severity} · {new Date(fault).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric' })} · on call: {sb.engineer}
          </p>
        </div>
        <button onClick={() => window.print()} className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 print:hidden">
          <Printer className="h-4 w-4" /> Print / PDF
        </button>
      </header>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Duration', fmtDuration(resolved - fault)],
          ['Alert → fix', inc.mitigatedAt ? fmtDuration(Date.parse(inc.mitigatedAt) - alert) : '—'],
          ['Failed orders', fmtInt(impact.failedOrders)],
          ['Revenue impact', fmtINR(impact.inr)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{k}</p>
            <p className="mt-1 text-xl font-bold tabular-nums">{v}</p>
          </div>
        ))}
      </section>

      <Section title="Summary">
        <p>{inc.summary ?? `${def.title}. ${inc.recommended ?? def.recommended} was the plan; see the timeline for what was tried.`}</p>
      </Section>

      <Section title="Root cause">
        <p>{inc.rootCause}</p>
      </Section>

      <Section title="Root cause analysis (5 whys)">
        <ol className="list-decimal space-y-1 pl-5">
          {ins.fiveWhys.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ol>
      </Section>

      <Section title="Customer impact">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <span className="font-semibold">Who:</span> {ins.customer.who}.
          </li>
          <li>
            <span className="font-semibold">What they saw:</span> {ins.customer.sees}.
          </li>
          <li>
            <span className="font-semibold">Scale:</span> {ins.customer.scale}; {ins.customer.support}.
          </li>
          <li>
            <span className="font-semibold">What still worked:</span> {ins.customer.unaffected}.
          </li>
        </ul>
      </Section>

      <Section title="Region impact">
        <table className="w-full max-w-md text-sm">
          <tbody>
            {ins.regions.map((r) => (
              <tr key={r.region} className="border-b border-slate-200">
                <td className="py-1.5 pr-4">{r.region}</td>
                <td className="py-1.5 font-mono">{r.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2">{ins.scope}</p>
      </Section>

      <Section title="Timeline (IST)">
        <ol className="space-y-1.5">
          {timeline.map((a) => (
            <li key={a.id} className="grid grid-cols-[72px_1fr] gap-3">
              <span className="font-mono text-sm text-slate-500">{fmtClock(a.at)}</span>
              <span>
                {a.title}
                {a.approval ? <span className="text-emerald-700"> (approved: “{a.approval}”)</span> : null}
              </span>
            </li>
          ))}
        </ol>
      </Section>

      {approvals.length > 0 && (
        <Section title="Production changes and approvals">
          <ul className="list-disc space-y-1 pl-5">
            {approvals.map((a) => (
              <li key={a.id}>
                {a.title}: approved by {sb.engineer} with the words “{a.approval}”. {a.detail}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="What went well">
        <ul className="list-disc space-y-1 pl-5">
          <li>Vigil had a diagnosis {fmtDuration(31_000)} after the alert, before anyone was woken up.</li>
          {inc.learnedFrom ? (
            <li>
              Vigil recognised a repeat of {inc.learnedFrom.id} and recommended what fixed it last time: {inc.learnedFrom.fix}.
            </li>
          ) : null}
          {lessons.well.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </Section>

      <Section title="What we will improve">
        <ul className="list-disc space-y-1 pl-5">
          {lessons.worse.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </Section>

      <Section title="Action items">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="py-2 pr-3">Ticket</th>
              <th className="py-2 pr-3">Action</th>
              <th className="py-2 pr-3">Owner</th>
              <th className="py-2">Priority</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {inc.followUps.map((f) => (
              <tr key={f.key}>
                <td className="py-2 pr-3 font-mono">
                  {f.url ? (
                    <a href={f.url} className="text-sky-700 underline" target="_blank" rel="noreferrer">
                      {f.key}
                    </a>
                  ) : (
                    f.key
                  )}
                </td>
                <td className="py-2 pr-3">{f.title}</td>
                <td className="py-2 pr-3">{f.owner}</td>
                <td className="py-2">{f.priority}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {inc.statusUpdates.length > 0 && (
        <Section title="Customer communication">
          <ul className="space-y-1.5">
            {inc.statusUpdates.map((u, i) => (
              <li key={i}>
                <span className="font-mono text-sm text-slate-500">{fmtClock(u.at)}</span> · {u.status}: {u.text}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {sb.transcript.length > 0 && (
        <Section title="From the call">
          <div className="space-y-1.5 rounded-xl bg-slate-50 p-4 text-sm">
            {sb.transcript.map((l, i) => (
              <p key={i}>
                <span className="font-semibold">{l.who === 'agent' ? 'Vigil' : l.who === 'teammate' ? 'Teammate' : sb.engineer}:</span> {l.text}
              </p>
            ))}
          </div>
        </Section>
      )}
      <p className="mt-10 text-xs text-slate-400">Review booked for 9:30 AM. Thali is a fictional company; this postmortem was generated in a Vigil demo sandbox.</p>
    </article>
  );
}

// The call transcript as a text file: proof of what was said, who approved what, and when.
function downloadTranscript(sb: Sandbox) {
  const inc = sb.incident!;
  const t = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const who = (w: string) => (w === 'agent' ? 'Vigil' : w === 'teammate' ? 'Teammate' : sb.engineer);
  const lines = [
    'Vigil call transcript',
    `Incident: ${inc.id} · ${inc.severity} · ${inc.title}`,
    `On call: ${sb.engineer} · Thali (simulated) · Vigil sandbox ${sb.id}`,
    `Downloaded: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`,
    '',
    'Conversation (IST)',
    ...sb.transcript.map((l) => `[${t(l.at)}] ${who(l.who)}${l.typed ? ' (typed)' : ''}: ${l.text}`),
    '',
    'Production changes and approvals',
    ...sb.actions.filter((a) => a.approval).map((a) => `[${t(a.at)}] ${a.title} (approved by ${sb.engineer}: "${a.approval}")`),
    '',
    'Timeline',
    ...sb.actions.map((a) => `[${t(a.at)}] ${a.title}`),
  ];
  const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `vigil-${inc.id}-call-transcript.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 break-inside-avoid">
      <h2 className="mb-2 text-lg font-bold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}
