import { Check } from 'lucide-react';
import Footnote from './Footnote';

const ROWS: { label: string; tools: string; bots: string; vigil: string }[] = [
  {
    label: 'Where it talks to you',
    tools: 'Slack or a web UI',
    bots: 'A phone call',
    vigil: 'A live voice call over Agora RTC, with typing as a fallback',
  },
  {
    label: 'When it calls',
    tools: 'It doesn’t',
    bots: 'As soon as the alert fires',
    vigil: 'After it has investigated, with the cause and the fix',
  },
  {
    label: 'Acts on production',
    tools: 'Mostly read-only, or suggests',
    bots: 'One scripted rollback',
    vigil: 'Allow-listed fixes, each gated by a spoken yes checked in code',
  },
  {
    label: 'When the fix fails',
    tools: 'A human takes over',
    bots: 'Not covered',
    vigil: 'Explains why and offers the next-safest fix',
  },
  {
    label: 'Proves recovery',
    tools: 'Sometimes',
    bots: 'Some re-check one dashboard',
    vigil: 'Verifies from live metrics before saying it worked',
  },
  {
    label: 'Teammates',
    tools: 'A separate bridge call',
    bots: 'No',
    vigil: 'Pages a teammate into the same live call and briefs them by voice',
  },
  {
    label: 'After the incident',
    tools: 'Postmortem inside the tool',
    bots: 'No',
    vigil: 'Status page, incident channel, follow-up tickets, postmortem with timeline',
  },
  {
    label: 'Untrusted log text',
    tools: 'Varies',
    bots: 'Not handled',
    vigil: 'Treated as data, with a prompt-injection test in the demo',
  },
];

export default function Compare() {
  return (
    <section id="compare" aria-labelledby="compare-title" className="relative scroll-mt-16 py-24 md:py-36">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <div className="reveal max-w-3xl">
          <p className="text-[13px] font-medium uppercase tracking-[0.2em] text-brand">Compare</p>
          <h2 id="compare-title" className="mt-4 text-balance text-[clamp(2.1rem,4.6vw,3.75rem)] font-semibold leading-[1.05] tracking-tightest text-ink">
            The market is real. The voice is missing.
          </h2>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-dim">
            AI SRE is a billion-dollar category, and every leading product works in text. The voice prototypes stop at
            one rollback. Vigil does the whole incident.
          </p>
        </div>

        {/* Desktop and tablet: table */}
        <div className="reveal mt-14 hidden overflow-hidden rounded-[1.5rem] border border-white/[0.07] md:block">
          <table className="w-full table-fixed border-collapse text-left text-[14px]">
            <caption className="sr-only">How Vigil compares with today&rsquo;s AI SRE tools and hackathon voice bots</caption>
            <colgroup>
              <col className="w-[20%]" />
              <col className="w-[25%]" />
              <col className="w-[22%]" />
              <col className="w-[33%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-white/[0.07] bg-surface/70">
                <th scope="col" className="px-6 py-5 font-medium text-faint">
                  <span className="sr-only">Capability</span>
                </th>
                <th scope="col" className="px-6 py-5 align-bottom font-medium text-dim">
                  Today&rsquo;s AI SRE tools
                  <span className="mt-1 block text-[12px] font-normal text-faint">
                    Resolve, Bits AI,{' '}
                    <span className="whitespace-nowrap">
                      PagerDuty
                      <Footnote ids={[7, 8, 9]} />
                    </span>
                  </span>
                </th>
                <th scope="col" className="px-6 py-5 align-bottom font-medium text-dim">
                  Hackathon voice bots
                  <span className="mt-1 block text-[12px] font-normal text-faint">
                    VoiceOps, EZ OnCall,{' '}
                    <span className="whitespace-nowrap">
                      OpsPilot
                      <Footnote ids={[10, 11, 12]} />
                    </span>
                  </span>
                </th>
                <th scope="col" className="border-x border-brand/30 bg-brand/[0.08] px-6 py-5 align-bottom text-[15px] font-semibold text-ink">
                  Vigil
                  <span className="mt-1 block text-[12px] font-normal text-brand">The AI on-call engineer</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, i) => (
                <tr key={row.label} className={i < ROWS.length - 1 ? 'border-b border-white/[0.05]' : ''}>
                  <th scope="row" className="px-6 py-4 align-top font-medium text-ink">
                    {row.label}
                  </th>
                  <td className="px-6 py-4 align-top text-dim">{row.tools}</td>
                  <td className="px-6 py-4 align-top text-dim">{row.bots}</td>
                  <td className="border-x border-brand/30 bg-brand/[0.06] px-6 py-4 align-top text-ink">
                    <span className="flex gap-2">
                      <Check className="mt-[3px] h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                      <span>{row.vigil}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Phones: one card per capability */}
        <ul className="mt-12 space-y-3 md:hidden">
          {ROWS.map((row) => (
            <li key={row.label} className="reveal panel p-5">
              <p className="text-[15px] font-semibold text-ink">{row.label}</p>
              <dl className="mt-3 space-y-2 text-[14px]">
                <div className="flex gap-3">
                  <dt className="w-24 shrink-0 text-faint">AI SRE tools</dt>
                  <dd className="text-dim">{row.tools}</dd>
                </div>
                <div className="flex gap-3">
                  <dt className="w-24 shrink-0 text-faint">Voice bots</dt>
                  <dd className="text-dim">{row.bots}</dd>
                </div>
                <div className="flex gap-3 rounded-xl bg-brand/[0.08] px-3 py-2 ring-1 ring-brand/25">
                  <dt className="w-[5.25rem] shrink-0 font-semibold text-brand">Vigil</dt>
                  <dd className="text-ink">{row.vigil}</dd>
                </div>
              </dl>
            </li>
          ))}
          <li className="px-1 pt-1 text-[12px] leading-7 text-faint">
            AI SRE tools: Resolve, Bits AI, PagerDuty
            <Footnote ids={[7, 8, 9]} /> · Voice bots: VoiceOps, EZ OnCall, OpsPilot
            <Footnote ids={[10, 11, 12]} />
          </li>
        </ul>
      </div>
    </section>
  );
}
