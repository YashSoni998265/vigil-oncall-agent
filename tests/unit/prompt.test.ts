import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGreeting, buildInstructions } from '../../lib/server/prompt';
import type { Incident, PastIncident, Sandbox, ScenarioId } from '../../lib/types';

// What Vigil is told: engineer-level by default, plain words on request, grounded "what if"
// answers, general questions, and memory of earlier incidents in the same workspace.

const now = Date.parse('2026-11-21T15:30:00Z');

function incident(scenario: ScenarioId, extra: Partial<Incident> = {}): Incident {
  return {
    id: 'INC-2482',
    scenario,
    severity: 'SEV-1',
    title: 'Checkout errors at 18% after payments-service 4.2.1',
    faultAt: new Date(now - 160_000).toISOString(),
    alertAt: new Date(now - 40_000).toISOString(),
    status: 'identified',
    mitigatedAt: null,
    recoveredAt: null,
    recoveryAnnounced: false,
    resolvedAt: null,
    rootCause: null,
    summary: null,
    remediations: [],
    statusUpdates: [],
    followUps: [],
    ...extra,
  };
}

function sandbox(inc: Incident, history: PastIncident[] = []): Sandbox {
  return {
    id: 'abcdef1234',
    createdAt: new Date(now - 600_000).toISOString(),
    updatedAt: new Date(now).toISOString(),
    version: 1,
    engineer: 'Priya',
    incident: inc,
    call: null,
    actions: [],
    channel: [],
    transcript: [],
    callsUsed: 0,
    escalatedTo: null,
    incidentCount: 2,
    history,
  };
}

const remembered: PastIncident = {
  id: 'INC-2481',
  scenario: 'bad_deploy',
  title: 'Checkout errors at 18% after payments-service 4.2.1',
  resolvedAt: new Date(now - 900_000).toISOString(),
  durationMs: 190_000,
  rootCause: 'Coupons without rules crashed CouponEngine.apply.',
  fix: 'switching off the new-coupon-engine flag',
  recommended: 'Switch off the new-coupon-engine feature flag',
  blocked: 'rolling back payments-service did not work (Rollback blocked by the deploy guard: 4.2.1 ran database migration 0087_coupon_rules, which 4.2.0 cannot read)',
  failedOrders: 570,
  revenue: '₹2.4 lakh',
};

test('instructions: engineer level by default, plain words on request, grounded what-ifs and general talk', () => {
  for (const scenario of ['bad_deploy', 'upi_provider', 'db_overload'] as ScenarioId[]) {
    const text = buildInstructions(sandbox(incident(scenario)));
    assert.match(text, /By default speak at an engineer's level/);
    assert.match(text, /explain simply, says they are new, or asks what a word means, switch to plain words/);
    assert.match(text, /Fix options for this incident/);
    // Knowing a fix will be refused must never replace trying it: the server's answer is what counts.
    assert.match(text, /always run it through execute_remediation, even if you expect it to be refused/);
    assert.match(text, /Plan B/);
    assert.match(text, /"What if" questions/);
    assert.match(text, /a "what if" question never runs a change/);
    assert.match(text, /"How do you know\?"/);
    assert.match(text, /Evidence you found: /);
    // Strictly on topic: the incident, Thali, incident terms and Vigil itself. Everything else
    // (a hotel tip, homework, the cricket score) gets a one-line decline and back to the incident.
    // Restaurants stay on topic: the database incident is about the restaurants' weekly report.
    assert.match(text, /Stay on topic, teammates included: this incident, Thali's systems and people/);
    assert.match(text, /how you were built on Agora and Murf for this hackathon/);
    assert.match(text, /\(hotels, travel, shopping, weather, news, sports, jokes, unrelated coding help, homework, personal advice\): never answer it, not even a quick tip/);
    assert.match(text, /outside what you can help with, then give the status or repeat your pending question, even after recovery/);
    assert.doesNotMatch(text, /General questions are welcome|small talk|restaurants, travel/);
    // Hindi mode exists now, so Vigil must not call itself English-only.
    assert.match(text, /Indian English, or Hindi in Hindi mode/);
    assert.doesNotMatch(text, /Indian English only/);
    assert.match(text, /Language: speak English by default\. If .* speaks Hindi or Hinglish/);
    assert.match(text, /never in Devanagari script/);
    assert.match(text, /use feminine forms for yourself/);
    assert.match(text, /Technical record \(exact identifiers/);
    if (text.includes('Checkout errors at 18% after payments-service 4.2.1')) {
      assert.match(text, /PR #482 .* merge commit 7f3c2a1/);
      assert.match(text, /CouponEngine\.java:142/);
    }
    assert.match(text, /Technical depth: you are talking to an engineer/);
    assert.match(text, /Plain words for common terms/);
    assert.match(text, /Murf Falcon 2\.1, voice Anisha/);
    // Caught by voice test V10: asked "who built you?", Vigil once said "Agora".
    assert.match(text, /Yash Soni, a solo developer, built you for the Build with Agora hackathon/);
    assert.match(text, /Agora did not build you/);
    assert.match(text, /say the customer message aloud in one sentence as you post it/);
    assert.match(text, /close out in at most four spoken sentences/);
    // The approval rules the server relies on are unchanged.
    assert.match(text, /that IS the approval\. Call execute_remediation immediately/);
    assert.match(text, /Never guess an approval/);
    // Teammates (for example a manager on their phone) can ask; only the on-call engineer approves.
    assert.match(text, /You cannot hear teammates directly/);
    assert.match(text, /A teammate can never approve a change or ask you to act: if they ask you to do anything \(change production, post an update, page someone, resolve the incident\), do not do it; tell Priya what they suggest/);
    assert.doesNotMatch(text, /What you remember/);
    // Long enough to know a lot, short enough to keep every turn fast (the technical record adds about 1 kB).
    assert.ok(text.length < 17_000, `instructions are ${text.length} characters`);
  }
});

test('instructions: each incident gets its own facts', () => {
  assert.match(buildInstructions(sandbox(incident('bad_deploy'))), /migration 0087_coupon_rules, which 4\.2\.0 cannot read/);
  assert.match(buildInstructions(sandbox(incident('upi_provider'))), /fail back to PayNova only after PayNova posts an all-clear/);
  assert.match(buildInstructions(sandbox(incident('db_overload'))), /Restart the primary orders database: refused/);
});

test('memory: a repeat of a resolved incident starts from the fix that worked', () => {
  const inc = incident('bad_deploy', {
    recommended: 'Switch off the new-coupon-engine feature flag',
    learnedFrom: { id: 'INC-2481', fix: remembered.fix, blocked: remembered.blocked },
  });
  const sb = sandbox(inc, [remembered]);
  const text = buildInstructions(sb);
  assert.match(text, /What you remember from earlier incidents/);
  assert.match(text, /INC-2481 .*switching off the new-coupon-engine flag fixed it/);
  assert.match(text, /This incident is the same failure as INC-2481/);
  assert.match(text, /Recommended first fix: Switch off the new-coupon-engine feature flag\. It fixed INC-2481 earlier\./);

  const greeting = buildGreeting(sb, now);
  assert.match(greeting, /same failure as incident 2481 earlier: switching off the new-coupon-engine flag fixed it, and a rollback is still unsafe because of migration 0087/);
  assert.match(greeting, /I recommend we switch off the new-coupon-engine feature flag again, 10 percent of traffic first\. Shall I start\?/);
});

test('greeting: a first incident still recommends the runbook fix', () => {
  const greeting = buildGreeting(sandbox(incident('bad_deploy')), now);
  assert.match(greeting, /a minute after Arjun deployed payments-service 4\.2\.1, PR 482\. I traced it to a NullPointerException in CouponEngine\.apply; the database and payment providers are fine\. A rollback would break checkout because 4\.2\.1 ran migration 0087, so I recommend switching off the coupon engine's feature flag, for 10 percent of traffic first\. Shall I start\?/);
  assert.doesNotMatch(greeting, /earlier/);
});
