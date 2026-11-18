import { DoorClosed, MicVocal, Ban, Activity, FileWarning, ListChecks } from 'lucide-react';

const GUARANTEES = [
  {
    icon: DoorClosed,
    title: 'One door to production',
    body: 'Only one tool can change anything, and only from an allow-list for the incident at hand.',
  },
  {
    icon: MicVocal,
    title: 'Your yes, checked in code',
    body: 'The server matches the approval to what you actually said or typed in the last two minutes. Questions, hedges and “wait” never execute.',
  },
  {
    icon: Ban,
    title: 'Unsafe fixes refused',
    body: 'Restarting the database mid-incident is refused with the reason, and Vigil offers the runbook’s safer step instead.',
  },
  {
    icon: Activity,
    title: 'Verified, not assumed',
    body: 'Recovery is read from live metrics before Vigil tells you it worked.',
  },
  {
    icon: FileWarning,
    title: 'Logs are data',
    body: 'Instructions hidden inside log lines are never followed. The demo includes one, on purpose.',
  },
  {
    icon: ListChecks,
    title: 'Idempotent and audited',
    body: 'Repeated actions return “already done”. Every call, input, result and approval quote lands in the timeline and the postmortem.',
  },
];

const ROWS = [
  {
    time: '21:13:04',
    action: 'rollback_deploy · payments-service',
    quote: '“should we roll back?”',
    outcome: 'Blocked',
    note: 'no spoken approval',
    tone: 'brand' as const,
  },
  {
    time: '21:13:11',
    action: 'rollback_deploy · payments-service',
    quote: '“Yes, roll it back.”',
    outcome: 'Failed',
    note: 'irreversible migration 0087',
    tone: 'warn' as const,
  },
  {
    time: '21:13:26',
    action: 'disable_feature_flag · new-coupon-engine',
    quote: '“Do it.”',
    outcome: 'Done',
    note: 'errors 18% → 0.4%, verified',
    tone: 'good' as const,
  },
];

const TONE = {
  brand: 'bg-brand/10 text-brand ring-brand/25',
  warn: 'bg-warn/10 text-warn ring-warn/25',
  good: 'bg-good/10 text-good ring-good/25',
};

export default function Safety() {
  return (
    <section id="safety" aria-labelledby="safety-title" className="relative isolate scroll-mt-16 overflow-hidden py-24 md:py-36">
      <div aria-hidden="true" className="pointer-events-none absolute right-[-18rem] top-[10rem] -z-10 h-[34rem] w-[34rem] rounded-full bg-brand/[0.08] blur-[140px]" />
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <div className="grid items-end gap-10 lg:grid-cols-[1.1fr_1fr]">
          <div className="reveal">
            <p className="text-[13px] font-medium uppercase tracking-[0.2em] text-brand">Safety in code</p>
            <h2 id="safety-title" className="mt-4 text-balance text-[clamp(2.1rem,4.6vw,3.75rem)] font-semibold leading-[1.05] tracking-tightest text-ink">
              Nothing touches production without your yes.
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-dim">
              Not a promise in a prompt. The server enforces it, logs it, and shows you every decision.
            </p>
          </div>

          {/* A real-looking slice of Vigil's action timeline */}
          <div className="reveal panel overflow-hidden [transition-delay:120ms]" role="region" aria-label="Example of Vigil's action timeline">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">What Vigil did · INC-2481</p>
              <span className="flex gap-1.5" aria-hidden="true">
                <span className="h-2 w-2 rounded-full bg-white/10" />
                <span className="h-2 w-2 rounded-full bg-white/10" />
                <span className="h-2 w-2 rounded-full bg-white/10" />
              </span>
            </div>
            <ul className="divide-y divide-white/[0.05]">
              {ROWS.map((row) => (
                <li key={row.time} className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 px-5 py-4 sm:grid-cols-[auto_1fr_auto]">
                  <span className="font-mono text-[12px] text-faint tabular">{row.time}</span>
                  <div className="min-w-0">
                    <p className="truncate font-mono text-[12.5px] text-ink">{row.action}</p>
                    <p className="mt-1 text-[12.5px] text-dim">
                      {row.quote} <span className="text-faint">· {row.note}</span>
                    </p>
                  </div>
                  <span
                    className={`col-start-2 w-fit self-start rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 sm:col-start-auto ${TONE[row.tone]}`}
                  >
                    {row.outcome}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:mt-20 lg:grid-cols-3">
          {GUARANTEES.map((g, i) => (
            <li key={g.title} className="reveal panel p-6 sm:p-7" style={{ transitionDelay: `${(i % 3) * 90}ms` }}>
              <g.icon className="h-5 w-5 text-brand" aria-hidden="true" />
              <h3 className="mt-5 text-[17px] font-semibold tracking-tight text-ink">{g.title}</h3>
              <p className="mt-2.5 text-[15px] leading-relaxed text-dim">{g.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
