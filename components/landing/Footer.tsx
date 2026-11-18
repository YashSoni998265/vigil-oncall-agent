import Logo from '@/components/brand/Logo';
import { SOURCES } from './sources';

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.07] bg-surface/30">
      <div className="mx-auto max-w-[1200px] px-5 py-16 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.6fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-dim">
              The AI on-call engineer that calls you with the fix, not the alert.
            </p>
            <p className="mt-6 text-[13px] text-faint">
              Built for Build with Agora · Bengaluru 2026 · ps31 Workplace
            </p>
            <p className="mt-1 text-[13px] text-faint">
              Thali, its people and its incidents are fictional. MIT licensed.
            </p>
          </div>

          <div id="sources" className="scroll-mt-20">
            <h2 className="text-[13px] font-medium uppercase tracking-[0.2em] text-faint">Sources</h2>
            <ol className="mt-5 grid gap-x-10 gap-y-3 text-[13px] leading-relaxed sm:grid-cols-2">
              {SOURCES.map((s) => (
                <li key={s.id} id={`src-${s.id}`} className="flex scroll-mt-24 gap-3 target:text-ink">
                  <span className="w-6 shrink-0 font-mono text-faint tabular">{s.id}.</span>
                  <span className="min-w-0">
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-words text-dim underline decoration-white/15 underline-offset-[3px] transition-colors hover:text-ink hover:decoration-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    >
                      {s.title}
                    </a>
                    <span className="text-faint"> · {s.publisher}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </footer>
  );
}
