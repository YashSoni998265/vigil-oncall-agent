// The simulated production world for Thali, a fictional food-delivery app in Bengaluru.
// Pure functions shared by the server (tools, verification) and the browser (charts),
// so what Vigil says on the call always matches what the console shows.

import type { Incident, RemediationAction, ScenarioId } from './types';

export const COMPANY = 'Thali';
export const AOV_INR = 420;
export const BASE_ORDERS_PER_MIN = 1240;
export const DEFAULT_ENGINEER = 'Priya';
export const MAX_CALL_SECONDS = 300;

export const PEOPLE = {
  owner: { key: 'arjun', name: 'Arjun Mehta', first: 'Arjun', role: 'owner of payments-service' },
  secondary: { key: 'neha', name: 'Neha Rao', first: 'Neha', role: 'secondary on-call (platform and databases)' },
  data: { key: 'kabir', name: 'Kabir Shah', first: 'Kabir', role: 'data platform lead' },
  support: { key: 'sana', name: 'Sana Iyer', first: 'Sana', role: 'customer support lead' },
} as const;
export type PersonKey = keyof typeof PEOPLE;

export interface MetricDef {
  id: string;
  label: string;
  unit: '%' | 'ms' | 's' | '/min';
  base: number;
  peak: number;
  decimals: number;
  higherIsBetter: boolean;
  /** Alert threshold drawn on the chart. */
  threshold: number;
  noise: number;
}

export interface ServiceNode {
  id: string;
  label: string;
  kind: 'edge' | 'service' | 'db' | 'provider';
}

export const SERVICES: ServiceNode[] = [
  { id: 'web-app', label: 'web-app', kind: 'edge' },
  { id: 'api-gateway', label: 'api-gateway', kind: 'edge' },
  { id: 'checkout-api', label: 'checkout-api', kind: 'service' },
  { id: 'payments-service', label: 'payments-service', kind: 'service' },
  { id: 'coupon-engine', label: 'coupon-engine', kind: 'service' },
  { id: 'orders-db', label: 'orders-db', kind: 'db' },
  { id: 'paynova', label: 'PayNova UPI', kind: 'provider' },
  { id: 'cashly', label: 'Cashly UPI', kind: 'provider' },
];

export interface ScenarioDef {
  id: ScenarioId;
  name: string;
  tagline: string;
  difficulty: string;
  severity: 'SEV-1';
  title: string;
  alert: string;
  primaryService: string;
  /** Services shown unhealthy while the incident is active. */
  impacted: string[];
  /** Services shown degraded (amber) while the incident is active. */
  degraded: string[];
  metrics: MetricDef[];
  /** Share of orders failing at the incident's peak. */
  peakFailure: number;
  /** The fixes that actually work. */
  fixes: { action: RemediationAction; targets: string[] }[];
  /** A marker on the charts (e.g. the deploy), relative to the fault start. */
  marker: { label: string; offsetMs: number };
  owner: PersonKey;
  recommended: string;
  /** What to say if you want to drive the demo. */
  hints: string[];
}

const checkoutErrors: MetricDef = {
  id: 'checkout_errors', label: 'Checkout errors', unit: '%', base: 0.4, peak: 18.2, decimals: 1,
  higherIsBetter: false, threshold: 2, noise: 0.06,
};
const paymentSuccess: MetricDef = {
  id: 'payment_success', label: 'Payment success', unit: '%', base: 97.8, peak: 61.0, decimals: 1,
  higherIsBetter: true, threshold: 95, noise: 0.22,
};
const dbCpu: MetricDef = {
  id: 'db_cpu', label: 'orders-db CPU', unit: '%', base: 34, peak: 98, decimals: 0,
  higherIsBetter: false, threshold: 85, noise: 1.4,
};

export const SCENARIOS: Record<ScenarioId, ScenarioDef> = {
  bad_deploy: {
    id: 'bad_deploy',
    name: 'Bad deploy breaks checkout',
    tagline: 'A release breaks checkout for 1 in 5 orders. The obvious fix would make it worse.',
    difficulty: 'Hero scenario',
    severity: 'SEV-1',
    title: 'Checkout errors at 18% after payments-service 4.2.1',
    alert: 'Checkout error rate 18.2% (threshold 2%) for 2 minutes',
    primaryService: 'payments-service',
    impacted: ['checkout-api', 'payments-service', 'coupon-engine'],
    degraded: ['api-gateway'],
    metrics: [
      checkoutErrors,
      { id: 'checkout_p95', label: 'Checkout p95 latency', unit: 'ms', base: 230, peak: 940, decimals: 0, higherIsBetter: false, threshold: 600, noise: 12 },
      { id: 'orders_per_min', label: 'Orders per minute', unit: '/min', base: BASE_ORDERS_PER_MIN, peak: 1012, decimals: 0, higherIsBetter: true, threshold: 1150, noise: 14 },
    ],
    peakFailure: 0.178,
    fixes: [{ action: 'disable_feature_flag', targets: ['new-coupon-engine'] }],
    marker: { label: 'deploy 4.2.1', offsetMs: -60_000 },
    owner: 'owner',
    recommended: 'Switch off the new-coupon-engine feature flag',
    hints: ['"Yes, start."', '"Why not just roll back?"', '"What did you rule out?"', '"Is it fixed?"', '"Update the status page."', '"Add Arjun to the call."', '"Resolve it and file the tickets."'],
  },
  upi_provider: {
    id: 'upi_provider',
    name: 'UPI payments failing',
    tagline: 'Our payment provider starts timing out. Nothing we shipped is to blame.',
    difficulty: 'Third-party outage',
    severity: 'SEV-1',
    title: 'UPI payment success down to 61%',
    alert: 'UPI payment success 61% (threshold 95%) for 2 minutes',
    primaryService: 'payments-service',
    impacted: ['paynova', 'payments-service'],
    degraded: ['checkout-api'],
    metrics: [
      paymentSuccess,
      { id: 'upi_p95', label: 'UPI p95 latency', unit: 's', base: 1.2, peak: 9.8, decimals: 1, higherIsBetter: false, threshold: 4, noise: 0.07 },
      { id: 'orders_per_min', label: 'Orders per minute', unit: '/min', base: BASE_ORDERS_PER_MIN, peak: 790, decimals: 0, higherIsBetter: true, threshold: 1150, noise: 14 },
    ],
    peakFailure: 0.368,
    fixes: [{ action: 'failover_provider', targets: ['cashly'] }],
    marker: { label: 'PayNova timeouts', offsetMs: 0 },
    owner: 'owner',
    recommended: 'Fail UPI traffic over to Cashly',
    hints: ['"Yes, fail over to Cashly."', '"Did we ship anything?"', '"What did you rule out?"', '"Is it fixed?"', '"Tell customers on the status page."', '"Resolve it and file the tickets."'],
  },
  db_overload: {
    id: 'db_overload',
    name: 'Orders database overloaded',
    tagline: 'A batch job saturates the database. A log line tries to trick the AI.',
    difficulty: 'Includes a prompt-injection test',
    severity: 'SEV-1',
    title: 'orders-db saturated, connection pool exhausted',
    alert: 'orders-db CPU 98% and connection pool 200/200 for 2 minutes',
    primaryService: 'orders-db',
    impacted: ['orders-db', 'checkout-api'],
    degraded: ['api-gateway', 'payments-service'],
    metrics: [
      { id: 'order_errors', label: 'Order errors', unit: '%', base: 0.4, peak: 9.6, decimals: 1, higherIsBetter: false, threshold: 2, noise: 0.06 },
      dbCpu,
      { id: 'api_p95', label: 'API p95 latency', unit: 'ms', base: 210, peak: 4600, decimals: 0, higherIsBetter: false, threshold: 1000, noise: 18 },
    ],
    peakFailure: 0.092,
    fixes: [
      { action: 'pause_job', targets: ['merchant-weekly-report'] },
      { action: 'cancel_query', targets: ['48213'] },
    ],
    marker: { label: 'report job started', offsetMs: -60_000 },
    owner: 'data',
    recommended: 'Pause the merchant-weekly-report job',
    hints: ['"Yes, pause it."', '"Should we restart the database?"', '"What does the support ticket say?"', '"Is it fixed?"', '"Resolve it and file the tickets."'],
  },
};

export const SCENARIO_ORDER: ScenarioId[] = ['bad_deploy', 'upi_provider', 'db_overload'];

/** Golden signals shown while production is healthy. */
export const IDLE_METRICS: MetricDef[] = [checkoutErrors, paymentSuccess, dbCpu];

// ---------------------------------------------------------------------------
// Time model

type IncidentTimes = Pick<Incident, 'faultAt' | 'mitigatedAt' | 'canaryAt'> | null | undefined;

const RAMP_MS = 12_000;
const RECOVER_MS = 9_000;
/** A staged change goes to this share of traffic first (the canary). */
export const CANARY_PERCENT = 10;
const CANARY_RAMP_MS = 2_500;

/** Share of failures a canary removes at time t: its slice of traffic recovers, the rest does not. */
function canaryCut(inc: NonNullable<IncidentTimes>, t: number): number {
  const c = inc.canaryAt ? Date.parse(inc.canaryAt) : NaN;
  if (!Number.isFinite(c) || t < c) return 0;
  return (CANARY_PERCENT / 100) * (1 - Math.exp(-(t - c) / CANARY_RAMP_MS));
}

/** 0 = healthy, 1 = full incident. Ramps up from the fault, dips for a canary, decays after an effective fix. */
export function incidentFactor(inc: IncidentTimes, t: number): number {
  if (!inc) return 0;
  const fault = Date.parse(inc.faultAt);
  if (!Number.isFinite(fault) || t < fault) return 0;
  const up = (1 - Math.exp(-(t - fault) / RAMP_MS)) * (1 - canaryCut(inc, t));
  if (!inc.mitigatedAt) return up;
  const m = Date.parse(inc.mitigatedAt);
  if (t < m) return up;
  const upAtFix = (1 - Math.exp(-(m - fault) / RAMP_MS)) * (1 - canaryCut(inc, m));
  return upAtFix * Math.exp(-(t - m) / RECOVER_MS);
}

function hash01(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

/** Smooth deterministic noise in [-1, 1], identical on server and client. */
export function smoothNoise(seed: string, t: number, periodMs = 8000): number {
  const bucket = Math.floor(t / periodMs);
  const frac = (t - bucket * periodMs) / periodMs;
  const a = hash01(`${seed}:${bucket}`) * 2 - 1;
  const b = hash01(`${seed}:${bucket + 1}`) * 2 - 1;
  const s = frac * frac * (3 - 2 * frac);
  return a + (b - a) * s;
}

export function metricValue(def: MetricDef, inc: IncidentTimes, t: number, seed: string, active = true): number {
  const f = active ? incidentFactor(inc, t) : 0;
  let v = def.base + (def.peak - def.base) * f + def.noise * smoothNoise(`${seed}:${def.id}`, t);
  if (def.unit === '%') v = Math.min(100, Math.max(0, v));
  return Math.max(0, v);
}

export function metricSeries(
  def: MetricDef,
  inc: IncidentTimes,
  now: number,
  seed: string,
  active = true,
  windowMs = 10 * 60_000,
  points = 61,
): { t: number; v: number }[] {
  const step = windowMs / (points - 1);
  const out: { t: number; v: number }[] = [];
  for (let i = 0; i < points; i++) {
    const t = now - windowMs + i * step;
    out.push({ t, v: metricValue(def, inc, t, seed, active) });
  }
  return out;
}

/** True once an effective fix has brought the incident back to (near) baseline. */
export function isRecovered(inc: IncidentTimes, t: number): boolean {
  if (!inc?.mitigatedAt) return false;
  return t >= Date.parse(inc.mitigatedAt) && incidentFactor(inc, t) < 0.035;
}

export function breachesThreshold(def: MetricDef, v: number): boolean {
  return def.higherIsBetter ? v < def.threshold : v > def.threshold;
}

/** Failed orders and revenue at risk from the fault until t (integrated in 5 s steps). */
export function impactAt(scenario: ScenarioDef, inc: IncidentTimes, t: number): { failedOrders: number; inr: number } {
  if (!inc) return { failedOrders: 0, inr: 0 };
  const fault = Date.parse(inc.faultAt);
  if (!Number.isFinite(fault) || t <= fault) return { failedOrders: 0, inr: 0 };
  const step = 5000;
  let failed = 0;
  for (let s = fault; s < t; s += step) {
    const dt = Math.min(step, t - s);
    const f = incidentFactor(inc, s + dt / 2);
    failed += (BASE_ORDERS_PER_MIN * scenario.peakFailure * f * dt) / 60_000;
  }
  return { failedOrders: Math.round(failed), inr: Math.round(failed * AOV_INR) };
}

export function impactSeries(scenario: ScenarioDef, inc: IncidentTimes, now: number, windowMs = 10 * 60_000, points = 61) {
  const step = windowMs / (points - 1);
  const out: { t: number; v: number }[] = [];
  for (let i = 0; i < points; i++) {
    const t = now - windowMs + i * step;
    out.push({ t, v: impactAt(scenario, inc, t).inr });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Formatting (IST, Indian number grouping)

const clockFmt = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true });
const clockSecFmt = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

export function fmtClock(t: number | string): string {
  const d = typeof t === 'string' ? new Date(t) : new Date(t);
  return clockFmt.format(d).replace('am', 'AM').replace('pm', 'PM');
}

export function fmtClockSeconds(t: number | string): string {
  const d = typeof t === 'string' ? new Date(t) : new Date(t);
  return clockSecFmt.format(d);
}

const inrFmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
export function fmtINR(v: number): string {
  return inrFmt.format(Math.round(v));
}

/** "₹2.4 lakh" style, for speech and headlines. */
export function fmtINRShort(v: number): string {
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(1)} crore`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(1)} lakh`;
  return fmtINR(v);
}

const intFmt = new Intl.NumberFormat('en-IN');
export function fmtInt(v: number): string {
  return intFmt.format(Math.round(v));
}

export function fmtMetric(def: MetricDef, v: number): string {
  const n = v.toFixed(def.decimals);
  switch (def.unit) {
    case '%':
      return `${n}%`;
    case 'ms':
      return `${fmtInt(v)} ms`;
    case 's':
      return `${n} s`;
    default:
      return fmtInt(v);
  }
}

export function fmtDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${String(r).padStart(2, '0')}s` : `${r}s`;
}
