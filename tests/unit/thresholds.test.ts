import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Each team sets its own alert level per metric, and Vigil calls only when an incident crosses it.
// Also: before calling, Vigil checks regions, customer experience and a five-whys root cause analysis.
// Runs the real engine against the JSON file store in a temporary folder: no Redis, no Agora, no network.

process.env.VIGIL_DATA_DIR = mkdtempSync(path.join(tmpdir(), 'vigil-thresholds-'));

type Engine = typeof import('../../lib/server/engine');
type Store = typeof import('../../lib/server/store');
const unwrap = <T>(m: T): T => ((m as { default?: T }).default ?? m) as T;
const load = async () => ({
  engine: unwrap<Engine>(await import('../../lib/server/engine')),
  store: unwrap<Store>(await import('../../lib/server/store')),
});

test('a team threshold above the incident peak: Vigil does not call, and says why', async () => {
  const { engine, store } = await load();
  const sb = await engine.newSandbox('Priya');
  assert.equal(await engine.setThreshold(sb.id, 'checkout_errors', 25), true);
  const r = await engine.triggerIncident(sb.id, 'bad_deploy');
  assert.equal(r.ok, false);
  assert.match(r.error ?? '', /would reach 18\.2%, which is inside your alert threshold of 25(\.0)?%, so Vigil would not call anyone/);
  const d = await store.readSandbox(sb.id);
  assert.equal(d?.incident ?? null, null, 'no incident, no call');
});

test('a team threshold the incident crosses: Vigil calls, and the alert names the team threshold', async () => {
  const { engine, store } = await load();
  const sb = await engine.newSandbox('Priya');
  await engine.setThreshold(sb.id, 'checkout_errors', 5);
  const r = await engine.triggerIncident(sb.id, 'bad_deploy');
  assert.equal(r.ok, true);
  const d = await store.readSandbox(sb.id);
  assert.ok(d?.actions.some((a) => /^Alert: .*\(your threshold 5(\.0)?%\)/.test(a.title)), 'alert names the team threshold');
  assert.equal(d?.call?.status, 'investigating');
  // Before calling: region check, customer experience and the five whys are on the timeline.
  assert.ok(d?.actions.some((a) => /^Checked regions: Mumbai 18\.3%, Delhi 18\.1%, Bengaluru 18\.2%, Hyderabad 18\.0%\. Everyone, not one region$/.test(a.title)));
  assert.ok(d?.actions.some((a) => a.tool === 'get_incident' && /Customers: Customers who apply a coupon/.test(a.detail ?? '')));
  assert.ok(d?.actions.some((a) => a.tool === 'root_cause_analysis' && /^Root cause analysis \(5 whys\): Coupons created before migration 0087/.test(a.title)));
});

test('thresholds: unknown metrics and bad values are refused; the default clears the override', async () => {
  const { engine, store } = await load();
  const sb = await engine.newSandbox('Priya');
  assert.equal(await engine.setThreshold(sb.id, 'no_such_metric', 5), false);
  assert.equal(await engine.setThreshold(sb.id, 'checkout_errors', Number.NaN), false);
  assert.equal(await engine.setThreshold(sb.id, 'checkout_errors', -1), false);
  await engine.setThreshold(sb.id, 'checkout_errors', 7);
  assert.equal((await store.readSandbox(sb.id))?.thresholds?.checkout_errors, 7);
  await engine.setThreshold(sb.id, 'checkout_errors', null);
  assert.equal((await store.readSandbox(sb.id))?.thresholds?.checkout_errors, undefined);
});
