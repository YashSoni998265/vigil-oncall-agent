import Footnote from './Footnote';
import styles from './landing.module.css';

const STATS: { value: string; unit?: string; label: string; sources: number[] }[] = [
  { value: '$794K', label: 'average cost of one customer-facing incident', sources: [1] },
  { value: '175', unit: 'min', label: 'average time to resolve it', sources: [1] },
  { value: '>$300K', label: 'cost of one hour of downtime for over 90% of mid-size and large firms', sources: [2] },
  { value: '~5', unit: 'hours', label: 'UPI outage on 12 April 2025, India’s third in 17 days', sources: [3, 4] },
];

export default function Numbers() {
  return (
    <section aria-labelledby="numbers-title" className="relative isolate overflow-hidden border-y border-white/[0.06] py-24 md:py-32">
      <div aria-hidden="true" className={`pointer-events-none absolute inset-0 -z-10 ${styles.grid}`} />
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[30rem] w-[60rem] max-w-[140vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-bad/[0.05] blur-[120px]" />

      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <div className="reveal mx-auto max-w-3xl text-center">
          <p className="text-[13px] font-medium uppercase tracking-[0.2em] text-brand">Why it matters</p>
          <h2 id="numbers-title" className="mt-4 text-balance text-[clamp(2.1rem,4.6vw,3.75rem)] font-semibold leading-[1.05] tracking-tightest text-ink">
            Every minute of an outage has a price.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-dim">
            Most of it is spent before anyone touches the fix: waking up, logging in, finding what changed, finding who
            owns it.
          </p>
        </div>

        <dl className="mt-16 grid grid-cols-1 gap-px overflow-hidden rounded-[1.5rem] border border-white/[0.07] bg-white/[0.07] sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((s, i) => (
            <div key={s.value} className="reveal bg-canvas p-7 sm:p-8" style={{ transitionDelay: `${i * 90}ms` }}>
              <dt className="sr-only">{s.label}</dt>
              <dd>
                <p className="whitespace-nowrap text-[clamp(2.75rem,4.6vw,3.75rem)] font-semibold leading-none tracking-tightest text-ink tabular">
                  {s.value}
                  {s.unit && <span className="ml-1.5 text-[0.42em] font-medium tracking-tight text-dim">{s.unit}</span>}
                  <Footnote ids={s.sources} />
                </p>
                <p className="mt-4 text-[15px] leading-relaxed text-dim">{s.label}</p>
              </dd>
            </div>
          ))}
        </dl>

        <div className="reveal mt-6 grid gap-4 text-[14px] text-dim md:grid-cols-2">
          <p className="panel px-6 py-5">
            <span className="font-semibold text-ink">Targets slip.</span>{' '}Teams aim for a 4.7-hour mean time to repair
            and actually get 7.8 hours. 59% of engineers say half their alerts aren&rsquo;t useful.
            <Footnote ids={[5]} />
          </p>
          <p className="panel px-6 py-5">
            <span className="font-semibold text-ink">People burn out.</span>{' '}Nearly 70% of SREs link on-call stress
            to burnout and to leaving their job (industry report, secondary coverage).
            <Footnote ids={[6]} />
          </p>
        </div>
      </div>
    </section>
  );
}
