import { Phone, Signal, Wifi, BatteryFull } from 'lucide-react';
import { LogoMark } from '@/components/brand/Logo';
import styles from './landing.module.css';

/** iPhone-style incoming call from Vigil, beside a live error-rate chart that recovers. */
export default function HeroVisual() {
  return (
    <div className="relative mx-auto max-w-[1200px] px-5 pb-24 sm:px-8 md:pb-32">
      <div className="relative mx-auto flex max-w-[960px] animate-fade-up flex-col items-center gap-8 [animation-delay:380ms] md:flex-row md:items-center md:justify-center md:gap-0">
        <PhoneCard />
        <ChartCard />
      </div>
    </div>
  );
}

function PhoneCard() {
  return (
    <div
      className="relative z-10 w-[296px] shrink-0 rounded-[3.1rem] border border-white/10 bg-gradient-to-b from-[#24242c] to-[#101015] p-[9px] shadow-[0_50px_120px_-30px_rgba(139,124,255,0.55),0_0_0_1px_rgba(255,255,255,0.04)_inset]"
      role="img"
      aria-label="Incoming call from Vigil about incident INC-2481. Vigil says: checkout is failing for 18 percent of orders since 2:43 AM, a minute after Arjun deployed payments-service 4.2.1. The logs point to the new coupon engine. Shall I roll back?"
    >
      <div className="relative h-[600px] overflow-hidden rounded-[2.55rem] bg-[radial-gradient(120%_70%_at_50%_0%,#2a2163_0%,#11111a_55%,#08080b_100%)] px-5 pb-6 pt-3">
        {/* Status bar + Dynamic Island */}
        <div className="flex items-center justify-between px-2 text-[12px] font-semibold text-white">
          <span className="tabular">2:47</span>
          <span className="h-[26px] w-[92px] rounded-full bg-black" aria-hidden="true" />
          <span className="flex items-center gap-1" aria-hidden="true">
            <Signal className="h-3.5 w-3.5" />
            <Wifi className="h-3.5 w-3.5" />
            <BatteryFull className="h-4 w-4" />
          </span>
        </div>

        <p className="mt-7 text-center text-[11px] font-medium uppercase tracking-[0.22em] text-white/55">Incoming call</p>

        {/* Caller */}
        <div className="relative mx-auto mt-5 flex h-[84px] w-[84px] items-center justify-center" aria-hidden="true">
          <span className="absolute inset-0 animate-ring-ripple rounded-full bg-brand/25" />
          <span className="absolute inset-0 animate-ring-ripple rounded-full bg-brand/25 [animation-delay:0.9s]" />
          <span className="relative flex h-[84px] w-[84px] items-center justify-center rounded-full bg-[#17142f] ring-1 ring-brand/40">
            <LogoMark size={42} />
          </span>
        </div>
        <p className="mt-4 text-center text-[28px] font-semibold tracking-tight text-white">Vigil</p>
        <p className="mt-0.5 text-center text-[13px] text-white/60">Incident INC-2481 · SEV-1 · Thali</p>

        {/* What Vigil is saying */}
        <div className="mt-5 rounded-[1.4rem] bg-white/[0.07] p-4 text-left ring-1 ring-white/10 backdrop-blur">
          <div className={`${styles.wave} mb-2.5 flex h-[18px] items-center gap-[3px]`} aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <p className="text-[13px] leading-[1.5] text-white/90">
            &ldquo;Checkout is failing for <span className="font-semibold text-white">18% of orders</span> since 2:43 AM,
            a minute after Arjun deployed payments-service 4.2.1. The logs point to the new coupon engine.
            <span className="font-semibold text-white"> Shall I roll back?</span>&rdquo;
          </p>
        </div>

        {/* Slide to answer */}
        <div className="absolute inset-x-5 bottom-6" aria-hidden="true">
          <div className="flex h-[58px] items-center rounded-full bg-white/[0.09] p-[6px] ring-1 ring-white/10 backdrop-blur">
            <span className="flex h-[46px] w-[46px] items-center justify-center rounded-full bg-white text-[#0b0b10] shadow-lg">
              <Phone className="h-5 w-5" />
            </span>
            <span className={`${styles.shimmerText} flex-1 pr-[46px] text-center text-[15px] font-medium`}>slide to answer</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChartCard() {
  const cycle = styles.cycle;
  return (
    <figure className="relative w-full max-w-[420px] rounded-[1.75rem] border border-white/10 bg-surface/85 p-5 shadow-[0_40px_100px_-40px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:p-6 md:-ml-8 md:translate-y-10 md:pl-14">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">checkout · error rate</p>
          <div className="relative mt-1.5 h-10" aria-hidden="true">
            <span className={`${cycle} ${styles.valueBad} absolute left-0 top-0 text-[34px] font-semibold leading-none tracking-tight text-bad tabular`}>
              18.2%
            </span>
            <span className={`${cycle} ${styles.valueGood} absolute left-0 top-0 text-[34px] font-semibold leading-none tracking-tight text-good tabular`}>
              0.4%
            </span>
          </div>
        </div>
        <div className="relative mt-0.5 h-7 w-[104px]" aria-hidden="true">
          <span className={`${cycle} ${styles.pillBad} absolute right-0 top-0 inline-flex items-center gap-1.5 rounded-full bg-bad/10 px-2.5 py-1 text-[11px] font-medium text-bad ring-1 ring-bad/25`}>
            <span className="h-1.5 w-1.5 rounded-full bg-bad" /> Incident
          </span>
          <span className={`${cycle} ${styles.pillGood} absolute right-0 top-0 inline-flex items-center gap-1.5 rounded-full bg-good/10 px-2.5 py-1 text-[11px] font-medium text-good ring-1 ring-good/25`}>
            <span className="h-1.5 w-1.5 rounded-full bg-good" /> Healthy
          </span>
        </div>
      </div>

      <svg
        viewBox="0 0 320 132"
        className="mt-5 h-auto w-full overflow-visible"
        role="img"
        aria-label="Checkout error rate spikes from 0.4 percent to 18 percent after a deploy, the rollback is blocked, and it falls back to 0.4 percent after the feature flag is disabled."
      >
        <defs>
          <linearGradient id="hero-spike-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(255 69 58)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="rgb(255 69 58)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Grid */}
        {[20, 52, 84, 116].map((y) => (
          <line key={y} x1="0" x2="320" y1={y} y2={y} stroke="rgb(255 255 255 / 0.06)" strokeWidth="1" />
        ))}
        {/* Deploy marker */}
        <line x1="120" x2="120" y1="8" y2="124" stroke="rgb(255 255 255 / 0.22)" strokeWidth="1" strokeDasharray="3 4" />
        <text x="124" y="16" fill="rgb(161 161 170)" fontSize="9.5" fontFamily="var(--font-mono), monospace">
          deploy 4.2.1
        </text>
        {/* Fix marker */}
        <line x1="212" x2="212" y1="8" y2="124" stroke="rgb(255 255 255 / 0.12)" strokeWidth="1" strokeDasharray="3 4" />
        <text x="216" y="16" fill="rgb(161 161 170)" fontSize="9.5" fontFamily="var(--font-mono), monospace">
          flag off
        </text>

        <path
          className={`${cycle} ${styles.spikeArea}`}
          d="M120 112 L134 46 L150 30 L166 36 L182 26 L198 32 L212 28 L212 124 L120 124 Z"
          fill="url(#hero-spike-area)"
          opacity="0"
        />
        <path
          className={`${cycle} ${styles.spike}`}
          pathLength={1}
          d="M0 114 L20 113 L40 114.5 L60 113 L80 114 L100 113 L120 112 L134 46 L150 30 L166 36 L182 26 L198 32 L212 28"
          fill="none"
          stroke="rgb(255 69 58)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          className={`${cycle} ${styles.recover}`}
          pathLength={1}
          d="M212 28 L226 58 L240 86 L256 104 L272 111 L290 113 L320 113.5"
          fill="none"
          stroke="rgb(48 209 88)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <g className={`${cycle} ${styles.dot}`}>
          <circle cx="320" cy="113.5" r="7" fill="rgb(48 209 88)" opacity="0.18" />
          <circle cx="320" cy="113.5" r="3.2" fill="rgb(48 209 88)" />
        </g>
      </svg>

      <figcaption className="relative mt-4 h-8" aria-hidden="true">
        <span
          className={`${cycle} ${styles.chipBlocked} absolute left-0 top-0 inline-flex items-center gap-1.5 rounded-full bg-warn/10 px-3 py-1.5 font-mono text-[11px] text-warn ring-1 ring-warn/25`}
        >
          Rollback blocked · irreversible migration
        </span>
        <span
          className={`${cycle} ${styles.chipFixed} absolute left-0 top-0 inline-flex items-center gap-1.5 rounded-full bg-good/10 px-3 py-1.5 font-mono text-[11px] text-good ring-1 ring-good/25`}
        >
          Disable flag new-coupon-engine ✓
        </span>
      </figcaption>

      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-4 text-[11px]">
        <div>
          <p className="text-faint">Diagnosed</p>
          <p className="mt-0.5 font-medium text-ink tabular">before ringing</p>
        </div>
        <div>
          <p className="text-faint">Approval</p>
          <p className="mt-0.5 font-medium text-ink">“Do it.”</p>
        </div>
        <div>
          <p className="text-faint">Recovery</p>
          <p className="mt-0.5 font-medium text-ink">verified live</p>
        </div>
      </div>
    </figure>
  );
}
