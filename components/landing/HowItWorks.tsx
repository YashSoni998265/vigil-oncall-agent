import { ScanSearch, PhoneCall, ShieldCheck, LineChart } from 'lucide-react';

const STEPS = [
  {
    icon: ScanSearch,
    title: 'Investigate',
    body: 'Before your phone rings, Vigil reads the alert, live metrics, recent deploys and flags, logs and the runbook.',
    detail: '7 read-only tools',
  },
  {
    icon: PhoneCall,
    title: 'Call',
    body: 'It calls with the cause and a recommended fix, not a wall of alerts. Interrupt any time; it listens.',
    detail: 'Agora RTC · Murf Falcon',
  },
  {
    icon: ShieldCheck,
    title: 'Act on your yes',
    body: 'A fix runs only after a clear spoken yes, checked by the server. If it fails, Vigil says why and offers the next-safest one.',
    detail: '1 gated tool',
  },
  {
    icon: LineChart,
    title: 'Prove it, close the loop',
    body: 'It verifies recovery from live metrics, then updates the status page and incident channel, files follow-ups and drafts the postmortem.',
    detail: '5 follow-through tools',
  },
];

export default function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-title" className="relative scroll-mt-16 py-24 md:py-36">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <div className="reveal max-w-3xl">
          <p className="text-[13px] font-medium uppercase tracking-[0.2em] text-brand">How it works</p>
          <h2 id="how-title" className="mt-4 text-balance text-[clamp(2.1rem,4.6vw,3.75rem)] font-semibold leading-[1.05] tracking-tightest text-ink">
            It calls you with the fix,
            <br className="hidden sm:block" /> not the alert.
          </h2>
        </div>

        <ol className="mt-14 grid gap-4 sm:grid-cols-2 lg:mt-20 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              className="reveal panel group relative flex flex-col p-6 transition-colors hover:border-brand/30 sm:p-7"
              style={{ transitionDelay: `${i * 90}ms` }}
            >
              <div className="flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/10 text-brand ring-1 ring-brand/20">
                  <step.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="font-mono text-[12px] text-faint tabular">0{i + 1}</span>
              </div>
              <h3 className="mt-7 text-xl font-semibold tracking-tight text-ink">{step.title}</h3>
              <p className="mt-3 flex-1 text-[15px] leading-relaxed text-dim">{step.body}</p>
              <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.12em] text-faint">{step.detail}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
