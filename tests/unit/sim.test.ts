import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIOS, fmtINR, fmtMetric, impactAt, incidentFactor, isRecovered, metricValue, smoothNoise } from '../../lib/sim';

const fault = Date.parse('2026-11-21T09:00:00Z');
const inc = { faultAt: new Date(fault).toISOString(), mitigatedAt: null as string | null };

test('healthy before the fault, full incident a minute later', () => {
  assert.equal(incidentFactor(inc, fault - 1000), 0);
  assert.ok(incidentFactor(inc, fault + 60_000) > 0.98);
});

test('an effective fix recovers to near baseline in about 30 seconds', () => {
  const fixed = { ...inc, mitigatedAt: new Date(fault + 180_000).toISOString() };
  assert.equal(isRecovered(fixed, fault + 180_000 + 15_000), false);
  assert.equal(isRecovered(fixed, fault + 180_000 + 22_000), false);
  assert.equal(isRecovered(fixed, fault + 180_000 + 32_000), true);
});

test('metrics follow the incident and stay within bounds', () => {
  const m = SCENARIOS.bad_deploy.metrics[0];
  const before = metricValue(m, inc, fault - 5000, 'seed');
  const during = metricValue(m, inc, fault + 120_000, 'seed');
  assert.ok(Math.abs(before - m.base) < 0.3, `before ${before}`);
  assert.ok(Math.abs(during - m.peak) < 0.5, `during ${during}`);
  const success = SCENARIOS.upi_provider.metrics[0];
  assert.ok(metricValue(success, null, fault, 'seed') <= 100);
});

test('noise is deterministic, so server and browser agree', () => {
  assert.equal(smoothNoise('abc', 123456), smoothNoise('abc', 123456));
  const n = smoothNoise('abc', 98765);
  assert.ok(n >= -1 && n <= 1);
});

test('revenue at risk grows during the incident and stops after the fix', () => {
  const def = SCENARIOS.bad_deploy;
  const a = impactAt(def, inc, fault + 60_000);
  const b = impactAt(def, inc, fault + 180_000);
  assert.ok(b.inr > a.inr && a.inr > 0);
  const fixed = { ...inc, mitigatedAt: new Date(fault + 180_000).toISOString() };
  const later = impactAt(def, fixed, fault + 600_000);
  const sooner = impactAt(def, fixed, fault + 240_000);
  assert.ok(later.inr - sooner.inr < 1000, 'stops growing once recovered');
  // ~220 failed orders a minute at ₹420 each.
  assert.ok(b.failedOrders > 500 && b.failedOrders < 700, `failed ${b.failedOrders}`);
});

test('formatting uses Indian conventions', () => {
  assert.equal(fmtINR(230734), '₹2,30,734');
  assert.equal(fmtMetric(SCENARIOS.bad_deploy.metrics[0], 18.24), '18.2%');
});
