import { BellRing, Cpu, Smartphone, Wrench } from 'lucide-react';

const PIPELINE = [
  {
    icon: BellRing,
    title: 'Alert',
    body: 'Error rate, latency or payment success crosses its threshold.',
  },
  {
    icon: Wrench,
    title: 'Investigate',
    body: 'Read-only tools: incident, service health, logs, changes, runbooks, dependencies.',
  },
  {
    icon: Cpu,
    title: 'Agora Conversational AI',
    body: 'ARES speech recognition (en-IN) → GPT-4.1 mini → Murf Falcon voice “Anusha”.',
  },
  {
    icon: Smartphone,
    title: 'Your phone',
    body: 'Agora RTC call with live captions over RTM. Teammates join the same channel.',
  },
];

const BADGES = [
  'Agora Conversational AI Engine',
  'Agora RTC',
  'Agora RTM',
  'Murf Falcon 2.1 · “Anusha” en-IN',
  'GPT-4.1 mini · Agora-managed',
  'ARES speech recognition · en-IN',
  '13 custom HTTPS tools',
  'think API for live updates',
];

export default function BuiltOn() {
  return (
    <section aria-labelledby="built-title" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <div className="reveal mx-auto max-w-3xl text-center">
          <p className="text-[13px] font-medium uppercase tracking-[0.2em] text-brand">Built on</p>
          <h2 id="built-title" className="mt-4 text-balance text-[clamp(2.1rem,4.6vw,3.75rem)] font-semibold leading-[1.05] tracking-tightest text-ink">
            Real-time voice, real tools.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-dim">
            Every word you hear is Murf Falcon. Every fix is an HTTPS tool call made by Agora&rsquo;s Conversational AI
            Engine, in the middle of the conversation.
          </p>
        </div>

        <ol className="relative mt-14 grid gap-4 md:grid-cols-4">
          {/* connecting line on desktop */}
          <span
            aria-hidden="true"
            className="absolute left-[12.5%] right-[12.5%] top-[2.35rem] hidden h-px bg-gradient-to-r from-brand/0 via-brand/40 to-brand/0 md:block"
          />
          {PIPELINE.map((step, i) => (
            <li
              key={step.title}
              className="reveal relative flex flex-col items-center px-2 text-center"
              style={{ transitionDelay: `${i * 90}ms` }}
            >
              <span
                className={`relative flex h-[4.7rem] w-[4.7rem] items-center justify-center rounded-[1.4rem] ring-1 ${
                  i === 2 ? 'bg-brand/15 text-brand ring-brand/40' : 'bg-surface text-ink ring-white/10'
                }`}
              >
                <step.icon className="h-6 w-6" aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-[16px] font-semibold tracking-tight text-ink">{step.title}</h3>
              <p className="mt-2 max-w-[16rem] text-[14px] leading-relaxed text-dim">{step.body}</p>
            </li>
          ))}
        </ol>

        <ul className="reveal mx-auto mt-14 flex max-w-4xl flex-wrap justify-center gap-2.5" aria-label="Technology used">
          {BADGES.map((b) => (
            <li
              key={b}
              className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-[13px] text-dim"
            >
              {b}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
