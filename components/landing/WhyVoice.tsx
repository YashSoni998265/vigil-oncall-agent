import { MoonStar, Users, Keyboard } from 'lucide-react';

const REASONS = [
  {
    icon: MoonStar,
    title: 'Half-asleep. Hands busy.',
    body: 'At 2:47 AM nobody reads twelve dashboards well. One calm voice with one clear question beats forty Slack messages.',
  },
  {
    icon: Users,
    title: 'Incidents already run on calls.',
    body: '“Add Arjun to the call.” Vigil pages a teammate into the same live call over Agora RTC and briefs them in two sentences.',
  },
  {
    icon: Keyboard,
    title: 'Loud room? Type.',
    body: 'Every call has a text box. Typed approvals are checked exactly like spoken ones.',
  },
];

export default function WhyVoice() {
  return (
    <section aria-labelledby="voice-title" className="relative border-y border-white/[0.06] bg-surface/40 py-24 md:py-32">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <div className="reveal">
            <p className="text-[13px] font-medium uppercase tracking-[0.2em] text-brand">Why voice</p>
            <h2 id="voice-title" className="mt-4 text-balance text-[clamp(2.1rem,4.6vw,3.75rem)] font-semibold leading-[1.05] tracking-tightest text-ink">
              The fastest interface at 3 AM is a conversation.
            </h2>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-dim">
              Today&rsquo;s AI SRE tools live in Slack and web dashboards. Vigil meets you where incidents actually
              happen: on a call.
            </p>
          </div>
          <ul className="space-y-4">
            {REASONS.map((r, i) => (
              <li
                key={r.title}
                className="reveal panel flex gap-5 p-6 sm:p-7"
                style={{ transitionDelay: `${i * 90}ms` }}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.04] text-ink ring-1 ring-white/10">
                  <r.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-[17px] font-semibold tracking-tight text-ink">{r.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-dim">{r.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
