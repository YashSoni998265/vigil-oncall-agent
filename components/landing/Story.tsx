import { LogoMark } from '@/components/brand/Logo';

interface Moment {
  time: string;
  title: string;
  detail: string;
  quote?: boolean;
}

const TODAY: Moment[] = [
  { time: '2:47', title: 'CRITICAL: checkout errors 18%', detail: 'Her phone screams. Priya is fast asleep.' },
  { time: '2:49', title: 'Laptop, VPN, two-factor', detail: 'Still loading. Customers are still failing to pay.' },
  { time: '2:53', title: 'Dashboards', detail: 'Which service? Grafana, logs, traces, one tab at a time.' },
  { time: '2:57', title: 'Deploy history', detail: 'A payments release went out at 2:39.' },
  { time: '2:59', title: 'Slack', detail: 'Who shipped it? Arjun is asleep too.' },
  { time: '3:01', title: 'Still no fix', detail: 'About 3,000 orders have failed. Customers are posting screenshots online.' },
];

const WITH_VIGIL: Moment[] = [
  { time: '2:47:00', title: 'The alert fires', detail: 'Vigil reads the metrics, recent deploys, logs and the runbook first.' },
  {
    time: '2:47:20',
    title: 'Her phone rings',
    detail: '“Checkout is failing for 18% since 2:43, a minute after Arjun’s release. Shall I roll back?”',
    quote: true,
  },
  {
    time: '2:47:31',
    title: '“Yes, roll it back.”',
    detail: 'Blocked: the release ran an irreversible migration. Vigil explains and offers the safe fix.',
  },
  { time: '2:47:44', title: '“Do it.”', detail: 'Feature flag new-coupon-engine switched off.' },
  { time: '2:48:15', title: 'Recovery verified', detail: 'Errors back to 0.4%, read from live metrics, not assumed.' },
  { time: '2:49', title: 'Loop closed', detail: 'Status page, #incident, follow-ups and the postmortem draft. She goes back to sleep.' },
];

export default function Story() {
  return (
    <section id="story" aria-labelledby="story-title" className="relative py-24 md:py-36">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <div className="reveal max-w-4xl">
          <p className="text-[13px] font-medium uppercase tracking-[0.2em] text-brand">The story</p>
          <h2 id="story-title" className="mt-4 text-balance text-[clamp(2.25rem,5vw,4.25rem)] font-semibold leading-[1.04] tracking-tightest text-ink">
            2:47 AM. Checkout is down.
          </h2>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-dim md:text-xl">
            Priya is on call for a food-delivery app in Bengaluru. A release went out at 2:39. At 2:43, one in five
            customers can no longer pay.
          </p>
        </div>

        <div className="mt-14 grid gap-5 md:mt-20 md:grid-cols-2">
          {/* Today */}
          <article className="reveal panel flex flex-col p-6 sm:p-8" aria-labelledby="story-today">
            <header className="flex items-center justify-between">
              <h3 id="story-today" className="text-xl font-semibold tracking-tight text-ink">
                Today
              </h3>
              <span className="rounded-full bg-bad/10 px-3 py-1 text-[12px] font-medium text-bad ring-1 ring-bad/20">
                Still broken
              </span>
            </header>
            <ol className="mt-8 flex-1 space-y-0">
              {TODAY.map((m, i) => (
                <li key={m.time} className="relative grid grid-cols-[3.75rem_1fr] gap-4 pb-6 last:pb-0">
                  {i < TODAY.length - 1 && (
                    <span className="absolute left-[4.97rem] top-[1.15rem] h-[calc(100%-0.7rem)] w-px bg-white/[0.07]" aria-hidden="true" />
                  )}
                  <span className="pt-0.5 font-mono text-[12px] text-faint tabular">{m.time}</span>
                  <div className="relative pl-6">
                    <span className="absolute left-0 top-[0.45rem] h-2 w-2 rounded-full bg-bad/80" aria-hidden="true" />
                    <p className="text-[15px] font-medium text-ink">{m.title}</p>
                    <p className="mt-1 text-[14px] leading-relaxed text-dim">{m.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
            <footer className="mt-8 border-t border-white/[0.06] pt-6">
              <p className="text-[clamp(2.5rem,5vw,3.5rem)] font-semibold leading-none tracking-tightest text-ink tabular">14 min</p>
              <p className="mt-2 text-[14px] text-dim">just to find the cause. The fix hasn&rsquo;t even started.</p>
            </footer>
          </article>

          {/* With Vigil */}
          <article
            className="reveal relative flex flex-col overflow-hidden rounded-[1.25rem] border border-brand/25 bg-[linear-gradient(180deg,rgb(139_124_255/0.10),rgb(14_16_20/1)_45%)] p-6 sm:p-8 [transition-delay:120ms]"
            aria-labelledby="story-vigil"
          >
            <header className="flex items-center justify-between">
              <h3 id="story-vigil" className="flex items-center gap-2 text-xl font-semibold tracking-tight text-ink">
                <LogoMark size={22} /> With Vigil
              </h3>
              <span className="rounded-full bg-good/10 px-3 py-1 text-[12px] font-medium text-good ring-1 ring-good/20">
                Recovered
              </span>
            </header>
            <ol className="mt-8 flex-1">
              {WITH_VIGIL.map((m, i) => (
                <li key={m.time} className="relative grid grid-cols-[3.75rem_1fr] gap-4 pb-6 last:pb-0">
                  {i < WITH_VIGIL.length - 1 && (
                    <span className="absolute left-[4.97rem] top-[1.15rem] h-[calc(100%-0.7rem)] w-px bg-brand/20" aria-hidden="true" />
                  )}
                  <span className="pt-0.5 font-mono text-[12px] text-faint tabular">{m.time}</span>
                  <div className="relative pl-6">
                    <span
                      className={`absolute left-0 top-[0.45rem] h-2 w-2 rounded-full ${i === WITH_VIGIL.length - 2 ? 'bg-good' : 'bg-brand'}`}
                      aria-hidden="true"
                    />
                    <p className="text-[15px] font-medium text-ink">{m.title}</p>
                    <p className={`mt-1 text-[14px] leading-relaxed ${m.quote ? 'text-ink/85' : 'text-dim'}`}>{m.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
            <footer className="mt-8 border-t border-white/[0.06] pt-6">
              <p className="text-[clamp(2.5rem,5vw,3.5rem)] font-semibold leading-none tracking-tightest text-brand-gradient tabular">
                ~2 min
              </p>
              <p className="mt-2 text-[14px] text-dim">from alert to verified recovery, with a human approving every change.</p>
            </footer>
          </article>
        </div>
      </div>
    </section>
  );
}
