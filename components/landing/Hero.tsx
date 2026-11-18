import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import HeroVisual from './HeroVisual';

export default function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden">
      {/* Night-sky glows */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-18rem] h-[44rem] w-[44rem] -translate-x-1/2 rounded-full bg-brand/[0.18] blur-[140px]" />
        <div className="absolute right-[-14rem] top-[26rem] h-[30rem] w-[30rem] rounded-full bg-sky/[0.08] blur-[120px]" />
        <div className="absolute left-[-16rem] top-[34rem] h-[26rem] w-[26rem] rounded-full bg-brand/[0.08] blur-[120px]" />
      </div>

      <div className="mx-auto max-w-[1200px] px-5 pb-16 pt-16 text-center sm:px-8 md:pb-20 md:pt-24">
        <p className="mx-auto inline-flex animate-fade-up items-center gap-2 rounded-full border border-line/10 bg-white/[0.03] px-3.5 py-1.5 text-[12px] text-dim">
          <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" />
          The AI on-call engineer
          <span className="hidden sm:inline">· Agora Conversational AI + Murf Falcon</span>
        </p>

        <h1
          id="hero-title"
          className="mx-auto mt-7 animate-fade-up text-[clamp(2.25rem,6.6vw,6.25rem)] font-semibold leading-[1.02] tracking-tightest [animation-delay:80ms]"
        >
          <span className="text-gradient block text-balance pb-[0.04em]">Production is down.</span>
          <span className="text-gradient block text-balance pb-[0.04em]">Your phone rings.</span>
          <span className="text-brand-gradient block text-balance pb-[0.08em]">It&rsquo;s already diagnosed.</span>
        </h1>

        <p className="mx-auto mt-7 max-w-[40rem] animate-fade-up text-[17px] leading-relaxed text-dim [animation-delay:160ms] sm:text-xl">
          Vigil is the AI on-call engineer that investigates first, calls you with the fix, acts only on your spoken
          yes, and closes the loop.
        </p>

        <div className="mt-9 flex animate-fade-up flex-col items-center justify-center gap-3 [animation-delay:240ms] sm:flex-row">
          <Link
            href="/console"
            className="group inline-flex h-12 items-center gap-2 rounded-full bg-ink px-6 text-[15px] font-medium text-canvas shadow-[0_8px_30px_-8px_rgba(139,124,255,0.6)] transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Break production (safely)
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
          <a
            href="#how"
            className="inline-flex h-12 items-center rounded-full border border-line/15 px-6 text-[15px] font-medium text-ink transition hover:border-line/30 hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            See how it works
          </a>
        </div>
        <p className="mt-4 animate-fade-up text-[13px] text-faint [animation-delay:300ms]">
          Your own private sandbox. Nothing real is harmed.
        </p>
      </div>

      <HeroVisual />
    </section>
  );
}
