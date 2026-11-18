'use client';

import { SCENARIOS, fmtClock, incidentFactor } from '@/lib/sim';
import type { Incident } from '@/lib/types';
import { useSandboxView } from './useSandboxView';

// Thali's public status page (what customers see). Vigil posts updates here during an incident.

type State = 'operational' | 'degraded' | 'outage';

const COMPONENTS: { name: string; services: string[] }[] = [
  { name: 'Website and app', services: ['web-app', 'api-gateway'] },
  { name: 'Checkout', services: ['checkout-api', 'coupon-engine'] },
  { name: 'Payments (cards)', services: ['payments-service'] },
  { name: 'Payments (UPI)', services: ['paynova', 'cashly'] },
  { name: 'Orders and tracking', services: ['orders-db'] },
];

function componentState(inc: Incident | null, services: string[], now: number): State {
  if (!inc || inc.status === 'resolved') return 'operational';
  const def = SCENARIOS[inc.scenario];
  if (incidentFactor(inc, now) < 0.1) return 'operational';
  if (services.some((s) => def.impacted.includes(s))) return 'outage';
  if (services.some((s) => def.degraded.includes(s))) return 'degraded';
  return 'operational';
}

const LABEL: Record<State, string> = { operational: 'Operational', degraded: 'Degraded performance', outage: 'Partial outage' };
const DOT: Record<State, string> = { operational: 'bg-emerald-500', degraded: 'bg-amber-500', outage: 'bg-red-500' };
const TEXT: Record<State, string> = { operational: 'text-emerald-700', degraded: 'text-amber-700', outage: 'text-red-700' };

export default function StatusPage({ id }: { id: string }) {
  const { view, missing } = useSandboxView(id, 4000);
  const now = view?.now ?? 0;
  const inc = view?.sandbox.incident ?? null;
  const states = COMPONENTS.map((c) => componentState(inc, c.services, now));
  const worst: State = states.includes('outage') ? 'outage' : states.includes('degraded') ? 'degraded' : 'operational';
  const updates = inc ? [...inc.statusUpdates].reverse() : [];
  const published = updates.length > 0;

  return (
    <div className="min-h-dvh bg-[#f6f7f9] text-slate-900" style={{ colorScheme: 'light' }}>
      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <header className="flex items-center justify-between">
          <p className="text-2xl font-bold tracking-tight">
            thali<span className="text-orange-500">.</span>
          </p>
          <p className="text-sm text-slate-500">Status</p>
        </header>

        {missing ? (
          <p className="mt-10 rounded-2xl bg-white p-6 text-slate-600 shadow-sm">This status page belongs to a demo sandbox that no longer exists.</p>
        ) : (
          <>
            <div
              className={`mt-8 rounded-2xl p-5 text-white shadow-sm ${
                !published && worst !== 'operational' ? 'bg-slate-700' : worst === 'operational' ? 'bg-emerald-600' : worst === 'degraded' ? 'bg-amber-500' : 'bg-red-600'
              }`}
              data-testid="status-banner"
            >
              <p className="text-lg font-semibold">
                {worst === 'operational' ? 'All systems operational' : published ? (inc ? SCENARIOS[inc.scenario].title.split(' after')[0] : '') : 'We are looking into a possible issue'}
              </p>
              {inc && published && <p className="mt-1 text-sm text-white/85">Latest update {fmtClock(updates[0].at)}</p>}
            </div>

            {updates.length > 0 && (
              <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm" aria-label="Incident updates">
                <h2 className="font-semibold">{inc?.id}: updates</h2>
                <ol className="mt-4 space-y-5">
                  {updates.map((u, i) => (
                    <li key={i} className="border-l-2 border-slate-200 pl-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {u.status} · {fmtClock(u.at)} IST
                      </p>
                      <p className="mt-1 text-[15px] leading-relaxed text-slate-800">{u.text}</p>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            <section className="mt-8 divide-y divide-slate-100 rounded-2xl bg-white shadow-sm" aria-label="Components">
              {COMPONENTS.map((c, i) => (
                <div key={c.name} className="flex items-center justify-between px-6 py-4">
                  <p className="font-medium">{c.name}</p>
                  <p className={`flex items-center gap-2 text-sm font-medium ${TEXT[states[i]]}`}>
                    <span className={`h-2.5 w-2.5 rounded-full ${DOT[states[i]]}`} /> {LABEL[states[i]]}
                  </p>
                </div>
              ))}
            </section>
            <p className="mt-8 text-center text-xs text-slate-400">Demo status page for a fictional company · updated live by Vigil</p>
          </>
        )}
      </div>
    </div>
  );
}
