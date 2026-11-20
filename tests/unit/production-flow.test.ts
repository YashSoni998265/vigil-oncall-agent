import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Production-grade incident handling, end to end through the real engine and tools against the JSON
// file store in a temporary folder (no Redis, no Agora, no GitHub, no network; effects are not run):
// a diagnosis that traces the dependency chain and checks every fix before recommending one, changes
// with change records that go to a 10% canary first, and a close-out in the order a real process uses.

process.env.VIGIL_DATA_DIR = mkdtempSync(path.join(tmpdir(), 'vigil-prod-'));

type Engine = typeof import('../../lib/server/engine');
type Store = typeof import('../../lib/server/store');
type Tools = typeof import('../../lib/server/tools');
type Sim = typeof import('../../lib/sim');
type Dx = typeof import('../../lib/server/diagnosis');
const unwrap = <T>(m: T): T => ((m as { default?: T }).default ?? m) as T;

async function load() {
  return {
    engine: unwrap<Engine>(await import('../../lib/server/engine')),
    store: unwrap<Store>(await import('../../lib/server/store')),
    tools: unwrap<Tools>(await import('../../lib/server/tools')),
    sim: unwrap<Sim>(await import('../../lib/sim')),
    dx: unwrap<Dx>(await import('../../lib/server/diagnosis')),
  };
}

/** An open bad-deploy incident with a live call, and the engineer's spoken words in the transcript. */
async function liveIncident(words: string[]) {
  const m = await load();
  const sb = await m.engine.newSandbox('Priya');
  await m.engine.triggerIncident(sb.id, 'bad_deploy');
  const at = new Date().toISOString();
  await m.store.mutateSandbox(sb.id, (d) => {
    d.call = {
      status: 'active', kind: 'page', attempt: 1, ringAt: null, retryAt: null, agentId: null, channel: null,
      engineerUid: '7729830', startedAt: at, lastSeenAt: at, endedAt: null, endReason: null,
      teammatePaged: null, teammateJoinedAt: null, teammateAnnounced: false,
    };
    for (const text of words) d.transcript.push({ at, who: 'engineer', text });
  });
  return { ...m, id: sb.id };
}

test('the investigation traces the dependency chain and checks every fix before recommending one', async () => {
  const { store, dx, id } = await liveIncident([]);
  const d = await store.readSandbox(id);
  const titles = (d?.actions ?? []).filter((a) => a.phase === 'before').map((a) => a.title);
  assert.ok(titles.some((t) => t === 'Traced it: checkout-api → payments-service → coupon-engine'), titles.join(' | '));
  assert.ok(titles.some((t) => t.startsWith('Checked each fix before recommending: rollback unsafe, feature flag safe')), titles.join(' | '));
  assert.ok(titles.some((t) => /Recommended: Switch off the new-coupon-engine feature flag, 10% canary first/.test(t)), titles.join(' | '));
  assert.equal(d?.incident?.recommended, 'Switch off the new-coupon-engine feature flag');
  for (const s of ['bad_deploy', 'upi_provider', 'db_overload'] as const) {
    const x = dx.diagnosis(s);
    assert.ok(x.path.length >= 3 && x.ruledOut.length >= 3, s);
    assert.ok(x.preflight.some((p) => p.verdict === 'safe') && x.preflight.some((p) => p.verdict !== 'safe'), s);
  }
});

test('an approved flag change goes to a 10% canary with a change record, then rolls out to everyone', async () => {
  const { engine, store, tools, sim, id } = await liveIncident(['Yes, start.']);
  const r = await tools.runTool('execute_remediation', id, { action: 'disable_feature_flag', target: 'new-coupon-engine', approval_quote: 'Yes, start.' });
  const body = r.body as Record<string, unknown>;
  assert.equal(body.executed, true);
  assert.equal(body.stage, 'canary');
  assert.match(String(body.change_id), /^CHG-\d+-1$/);
  let d = await store.readSandbox(id);
  assert.ok(d?.incident?.canaryAt, 'canary started');
  assert.equal(d?.incident?.mitigatedAt, null, 'not rolled out to everyone yet');
  assert.equal(d?.incident?.changes?.[0]?.status, 'canary');
  assert.equal(d?.incident?.changes?.[0]?.approval, 'Yes, start.');
  // The canary removes about a tenth of the failures before the full rollout.
  const inc = d!.incident!;
  const t = Date.parse(inc.canaryAt!) + 10_000;
  const before = sim.incidentFactor({ ...inc, canaryAt: null }, t);
  const during = sim.incidentFactor(inc, t);
  assert.ok(during < before && during > before * 0.85, `${during} vs ${before}`);
  // The same change again (with a fresh yes: one yes covers one change) is never applied twice.
  await store.mutateSandbox(id, (x) => {
    x.transcript.push({ at: new Date().toISOString(), who: 'engineer', text: 'Yes, start.' });
  });
  const again = await tools.runTool('execute_remediation', id, { action: 'disable_feature_flag', target: 'new-coupon-engine', approval_quote: 'Yes, start.' });
  assert.equal((again.body as Record<string, unknown>).already_done, true);

  // After the canary has run, the engine rolls it out to 100%.
  await store.mutateSandbox(id, (x) => {
    x.incident!.canaryAt = new Date(Date.now() - 16_000).toISOString();
  });
  d = await store.readSandbox(id);
  const { sandbox } = await engine.tick(d!);
  assert.ok(sandbox.incident?.mitigatedAt, 'rolled out');
  assert.equal(sandbox.incident?.changes?.[0]?.status, 'rolled_out');
  assert.match(String(sandbox.incident?.changes?.[0]?.canaryResult), /in the 10% canary vs .* for everyone else/);
  assert.ok(sandbox.actions.some((a) => /canary healthy, rolled out to 100%/.test(a.title)));
});

test('a refused fix still gets a change record, and never reaches production', async () => {
  const { store, tools, id } = await liveIncident(['Yes, roll it back.']);
  const r = await tools.runTool('execute_remediation', id, { action: 'rollback_deploy', target: 'payments-service', approval_quote: 'Yes, roll it back.' });
  assert.equal((r.body as Record<string, unknown>).executed, false);
  const d = await store.readSandbox(id);
  assert.equal(d?.incident?.canaryAt ?? null, null);
  assert.equal(d?.incident?.mitigatedAt, null);
  assert.equal(d?.incident?.changes?.[0]?.status, 'failed');
});

test('resolving closes out in order: resolved, status page, postmortem, tickets, review', async () => {
  const { store, tools, id } = await liveIncident([]);
  await store.mutateSandbox(id, (d) => {
    d.incident!.mitigatedAt = new Date(Date.now() - 120_000).toISOString();
  });
  const r = await tools.runTool('resolve_incident', id, { root_cause: '', summary: '' });
  const body = r.body as Record<string, unknown>;
  assert.equal(body.resolved, true);
  const d = await store.readSandbox(id);
  const order = (d?.actions ?? []).map((a) => a.title).filter((t) => /^[1-5]\. /.test(t));
  assert.deepEqual(order.map((t) => t.slice(0, 2)), ['1.', '2.', '3.', '4.', '5.']);
  assert.match(order[1], /Status page: resolved/);
  assert.match(order[2], /Postmortem drafted/);
  assert.match(order[3], /Filed 3 action items from the postmortem as tickets/);
  assert.equal(d?.incident?.statusUpdates.at(-1)?.status, 'resolved');
});
