import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { LogoMark } from '@/components/brand/Logo';

export default function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="relative isolate overflow-hidden py-28 md:py-40">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/[0.16] blur-[140px]" />
      </div>
      <div className="reveal mx-auto flex max-w-[1200px] flex-col items-center px-5 text-center sm:px-8">
        <LogoMark size={56} />
        <h2
          id="cta-title"
          className="mt-8 text-[clamp(2.6rem,6.4vw,5.5rem)] font-semibold leading-[1.02] tracking-tightest"
        >
          <span className="text-gradient">Break production.</span>
          <br />
          <span className="text-brand-gradient">Safely.</span>
        </h2>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-dim">
          Pick an incident, answer the call, and tell Vigil what to do. Your own private sandbox. Nothing real is harmed.
        </p>
        <Link
          href="/console"
          className="group mt-10 inline-flex h-14 items-center gap-2 rounded-full bg-ink px-8 text-[16px] font-medium text-canvas shadow-[0_10px_40px_-8px_rgba(139,124,255,0.7)] transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Open the live demo
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
        <p className="mt-4 text-[13px] text-faint">Works in Chrome or Safari. Allow the microphone, or type instead.</p>
      </div>
    </section>
  );
}
