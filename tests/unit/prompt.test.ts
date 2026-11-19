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
    assert.match(text, /Plan B/);
    assert.match(text, /"What if" questions/);
    assert.match(text, /a "what if" question never runs a change/);
    assert.match(text, /"How do you know\?"/);
    assert.match(text, /Evidence you found: /);
    assert.match(text, /General questions are welcome/);
    assert.match(text, /You cannot look up live news, weather, scores or prices/);
    assert.match(text, /Plain words for common terms/);
    assert.match(text, /Murf Falcon 2\.1, voice Anisha/);
    // Caught by voice test V10: asked "who built you?", Vigil once said "Agora".
    assert.match(text, /a solo developer built you for the Build with Agora hackathon/);
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
    // Long enough to know a lot, short enough to keep every turn fast.
    assert.ok(text.length < 16_000, `instructions are ${text.length} characters`);
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
  assert.match(greeting, /same failure as incident 2481 earlier: the rollback was blocked by migration 0087, and switching off the new-coupon-engine flag fixed it/);
  assert.match(greeting, /I recommend we switch off the new-coupon-engine feature flag right away\. Shall I\?/);
});

test('greeting: a first incident still recommends the runbook fix', () => {
  const greeting = buildGreeting(sandbox(incident('bad_deploy')), now);
  assert.match(greeting, /I recommend rolling back to 4\.2\.0\. Shall I go ahead\?/);
  assert.doesNotMatch(greeting, /earlier/);
});
