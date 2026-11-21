'use client';

import { useId, useMemo, useRef, useState } from 'react';
import {
  breachesThreshold,
  fmtClock,
  fmtClockSeconds,
  fmtINR,
  fmtINRShort,
  fmtInt,
  fmtMetric,
  impactAt,
  impactSeries,
  metricSeries,
  metricValue,
  type MetricDef,
  type ScenarioDef,
} from '@/lib/sim';
import type { Incident } from '@/lib/types';

const W = 600;
const H = 120;
const WINDOW_MS = 10 * 60_000;

type Tone = 'bad' | 'good' | 'neutral';
const TONE_RGB: Record<Tone, string> = {
  bad: 'rgb(var(--bad))',
  good: 'rgb(var(--good))',
  neutral: 'rgb(var(--ink) / 0.75)',
};

interface Marker {
  t: number;
  label: string;
  tone: 'neutral' | 'good';
}

function pathFor(points: { t: number; v: number }[], start: number, yMin: number, yMax: number) {
  const x = (t: number) => ((t - start) / WINDOW_MS) * W;
  const y = (v: number) => H - ((v - yMin) / (yMax - yMin)) * H;
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const area = `${line} L${W},${H} L0,${H} Z`;
  return { line, area, x, y };
}

function Chart({
  points,
  now,
  yMin,
  yMax,
  tone,
  threshold,
  markers,
  format,
  label,
}: {
  points: { t: number; v: number }[];
  now: number;
  yMin: number;
  yMax: number;
  tone: Tone;
  threshold?: number;
  markers: Marker[];
  format: (v: number) => string;
  label: string;
}) {
  const gradId = useId().replace(/:/g, '');
  const start = now - WINDOW_MS;
  const { line, area, x, y } = useMemo(() => pathFor(points, start, yMin, yMax), [points, start, yMin, yMax]);
  const box = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const color = TONE_RGB[tone];

  const onMove = (e: React.PointerEvent) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return;
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setHover(Math.round(frac * (points.length - 1)));
  };
  const hp = hover !== null ? points[hover] : null;

  return (
    <div
      ref={box}
      className="relative h-[120px] w-full touch-none select-none"
      onPointerMove={onMove}
      onPointerLeave={() => setHover(null)}
      role="img"
      aria-label={label}
    >
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={tone === 'neutral' ? 0.06 : 0.22} />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="rgb(var(--line) / 0.05)" vectorEffect="non-scaling-stroke" />
        ))}
        {threshold !== undefined && (
          <line x1="0" x2={W} y1={y(threshold)} y2={y(threshold)} stroke="rgb(var(--warn) / 0.55)" strokeDasharray="4 5" vectorEffect="non-scaling-stroke" />
        )}
        {markers
          .filter((m) => m.t >= start && m.t <= now)
          .map((m) => (
            <line
              key={m.label}
              x1={x(m.t)}
              x2={x(m.t)}
              y1="0"
              y2={H}
              stroke={m.tone === 'good' ? 'rgb(var(--good) / 0.7)' : 'rgb(var(--ink) / 0.28)'}
              strokeDasharray="3 4"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        <path d={area} fill={`url(#${gradId})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {hp && <line x1={x(hp.t)} x2={x(hp.t)} y1="0" y2={H} stroke="rgb(var(--ink) / 0.35)" vectorEffect="non-scaling-stroke" />}
      </svg>
      {markers
        .filter((m) => m.t >= start && m.t <= now)
        .sort((a, b) => a.t - b.t)
        .map((m, i, all) => {
          // Labels closer than ~16% of the width would collide: drop the later one a row.
          const crowded = i > 0 && x(m.t) - x(all[i - 1].t) < W * 0.16;
          return (
            <span
              key={m.label}
              className={`pointer-events-none absolute -translate-x-1/2 whitespace-nowrap rounded-md px-1.5 py-0.5 font-mono text-[10px] ${m.tone === 'good' ? 'bg-good/15 text-good' : 'bg-raised text-dim'}`}
              style={{ left: `${(x(m.t) / W) * 100}%`, top: crowded ? 18 : -4 }}
            >
              {m.label}
            </span>
          );
        })}
      {hp && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-line/10 bg-canvas/95 px-2.5 py-1.5 text-xs shadow-xl"
          style={{ left: `${(hover! / (points.length - 1)) * 100}%`, top: Math.max(4, Math.min(H - 44, y(hp.v) - 46)) }}
        >
          <p className="font-medium text-ink tabular">{format(hp.v)}</p>
          <p className="font-mono text-[10px] text-faint">{fmtClockSeconds(hp.t)}</p>
        </div>
      )}
    </div>
  );
}

function fmtDelta(def: MetricDef, d: number): string {
  const sign = d > 0 ? '+' : '−';
  const a = Math.abs(d);
  if (def.unit === '%') return `${sign}${a.toFixed(def.decimals)} pts`;
  if (def.unit === 'ms') return `${sign}${fmtInt(a)} ms`;
  if (def.unit === 's') return `${sign}${a.toFixed(1)} s`;
  return `${sign}${fmtInt(a)}`;
}

function domain(def: MetricDef): [number, number] {
  const lo = Math.min(def.base, def.peak, def.threshold);
  const hi = Math.max(def.base, def.peak, def.threshold);
  const pad = (hi - lo) * 0.1;
  return [Math.max(0, lo - pad), hi + pad];
}

export function MetricCard({
  def,
  incident,
  seed,
  now,
  markers,
  custom,
  onThreshold,
}: {
  def: MetricDef;
  incident: Incident | null;
  seed: string;
  now: number;
  markers: Marker[];
  /** The team set its own alert level for this metric. */
  custom?: boolean;
  /** Save the team's alert level (null resets it to the default). */
  onThreshold?: (value: number | null) => Promise<void>;
}) {
  const active = Boolean(incident);
  const points = useMemo(() => metricSeries(def, incident, now, seed, active), [def, incident, now, seed, active]);
  const current = metricValue(def, incident, now, seed, active);
  const breach = breachesThreshold(def, current);
  const tone: Tone = breach ? 'bad' : incident?.mitigatedAt ? 'good' : 'neutral';
  const [yMin, yMax] = domain(def);
  const delta = current - def.base;
  const worse = def.higherIsBetter ? delta < 0 : delta > 0;
  const fmt = (v: number) => fmtMetric(def, v);

  return (
    <section className="panel flex flex-col gap-3 p-4 sm:p-5" aria-live="off">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-dim">{def.label}</p>
          <p className={`mt-1 text-[28px] font-semibold leading-none tracking-tight tabular ${breach ? 'text-bad' : tone === 'good' ? 'text-good' : 'text-ink'}`}>{fmt(current)}</p>
        </div>
        <span
          className={`mt-0.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${
            breach ? 'bg-bad/12 text-bad' : tone === 'good' ? 'bg-good/12 text-good' : 'bg-raised text-faint'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${breach ? 'bg-bad animate-soft-pulse' : tone === 'good' ? 'bg-good' : 'bg-faint'}`} />
          {breach ? 'Breaching' : tone === 'good' ? 'Recovered' : 'Normal'}
        </span>
      </header>
      <Chart
        points={points}
        now={now}
        yMin={yMin}
        yMax={yMax}
        tone={tone}
        threshold={def.threshold}
        markers={markers}
        format={fmt}
        label={`${def.label}: now ${fmt(current)}, baseline ${fmt(def.base)}, alert threshold ${fmt(def.threshold)}`}
      />
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-faint">
        <span>Baseline {fmt(def.base)}</span>
        <ThresholdControl def={def} fmt={fmt} custom={Boolean(custom)} onThreshold={onThreshold} />
        {Math.abs(delta) > def.noise * 3 && <span className={worse ? 'text-bad' : 'text-good'}>{fmtDelta(def, delta)}</span>}
        <span className="ml-auto font-mono">10 min</span>
      </p>
    </section>
  );
}

/** "Alert at …", editable: each team sets its own level, and Vigil calls only when it is crossed. */
function ThresholdControl({
  def,
  fmt,
  custom,
  onThreshold,
}: {
  def: MetricDef;
  fmt: (v: number) => string;
  custom: boolean;
  onThreshold?: (value: number | null) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    const v = Number(draft);
    setEditing(false);
    if (!onThreshold || draft.trim() === '' || !Number.isFinite(v) || v === def.threshold) return;
    setSaving(true);
    await onThreshold(v).catch(() => {});
    setSaving(false);
  };
  if (editing) {
    return (
      <span className="inline-flex items-center gap-1">
        Alert at
        <input
          autoFocus
          type="number"
          step="any"
          inputMode="decimal"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void save()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void save();
            if (e.key === 'Escape') setEditing(false);
          }}
          aria-label={`Alert threshold for ${def.label}, in ${def.unit}`}
          className="w-16 rounded border border-line/20 bg-canvas px-1 py-0.5 text-[11px] text-ink focus:border-brand/60 focus:outline-none"
          data-testid={`threshold-input-${def.id}`}
        />
        {def.unit === '/min' ? '/min' : def.unit}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-block h-px w-3 border-t border-dashed border-warn/70" /> Alert {fmt(def.threshold)}
      {custom && <span className="text-brand">(yours)</span>}
      {onThreshold && (
        <button
          type="button"
          onClick={() => {
            setDraft(String(def.threshold));
            setEditing(true);
          }}
          disabled={saving}
          className="ml-0.5 rounded px-1 text-dim underline underline-offset-2 hover:text-ink disabled:opacity-50"
          title="Set your own alert level: Vigil calls only when it is crossed"
          data-testid={`threshold-edit-${def.id}`}
        >
          {saving ? 'Saving…' : 'Edit'}
        </button>
      )}
      {custom && onThreshold && (
        <button type="button" onClick={() => void onThreshold(null)} className="rounded px-1 text-dim underline underline-offset-2 hover:text-ink" title="Back to the default alert level">
          Reset
        </button>
      )}
    </span>
  );
}

export function ImpactCard({ scenario, incident, now }: { scenario: ScenarioDef | null; incident: Incident | null; now: number }) {
  const points = useMemo(
    () => (scenario && incident ? impactSeries(scenario, incident, now) : Array.from({ length: 61 }, (_, i) => ({ t: now - WINDOW_MS + (i * WINDOW_MS) / 60, v: 0 }))),
    [scenario, incident, now],
  );
  const impact = scenario && incident ? impactAt(scenario, incident, now) : { failedOrders: 0, inr: 0 };
  const growing = Boolean(incident && !incident.recoveredAt && incident.status !== 'resolved');
  const final = points[points.length - 1]?.v ?? 0;
  const yMax = Math.max(50_000, final * 1.15);
  const markers: Marker[] = incident?.mitigatedAt ? [{ t: Date.parse(incident.mitigatedAt), label: 'fix', tone: 'good' }] : [];

  return (
    <section className="panel flex flex-col gap-3 p-4 sm:p-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-dim">Revenue at risk</p>
          <p className={`mt-1 text-[28px] font-semibold leading-none tracking-tight tabular ${impact.inr > 0 ? (growing ? 'text-bad' : 'text-ink') : 'text-ink'}`}>{fmtINR(impact.inr)}</p>
        </div>
        <span className={`mt-0.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${growing ? 'bg-bad/12 text-bad' : impact.inr > 0 ? 'bg-good/12 text-good' : 'bg-raised text-faint'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${growing ? 'bg-bad animate-soft-pulse' : impact.inr > 0 ? 'bg-good' : 'bg-faint'}`} />
          {growing ? 'Growing' : impact.inr > 0 ? 'Stopped' : 'None'}
        </span>
      </header>
      <Chart
        points={points}
        now={now}
        yMin={0}
        yMax={yMax}
        tone={growing ? 'bad' : impact.inr > 0 ? 'good' : 'neutral'}
        markers={markers}
        format={(v) => fmtINRShort(v)}
        label={`Revenue at risk ${fmtINR(impact.inr)} from ${fmtInt(impact.failedOrders)} failed orders`}
      />
      <p className="flex flex-wrap gap-x-3 text-[11px] text-faint">
        <span>{fmtInt(impact.failedOrders)} failed orders × ₹420 average</span>
        {incident?.recoveredAt && <span className="text-good">Stopped growing at {fmtClock(incident.recoveredAt)}</span>}
        <span className="ml-auto font-mono">since fault</span>
      </p>
    </section>
  );
}
