import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recoveryAnnouncement } from '../../lib/server/announce';
import { SCENARIOS, fmtMetric } from '../../lib/sim';

test('the recovery sentence names the engineer, the metric and the baseline, in spoken form', () => {
  const s = recoveryAnnouncement('Yash', 'Checkout errors', '1.0%', '0.4%');
  assert.equal(
    s,
    'Yash, good news: checkout errors are back to 1 percent, near the 0.4 percent baseline. Live metrics confirm the fix. Shall I update the status page and post in the incident channel?',
  );
});

test('singular metrics read naturally', () => {
  assert.match(recoveryAnnouncement('Priya', 'Payment success', '97.5%', '97.8%'), /payment success is back to 97\.5 percent, near the 97\.8 percent baseline/);
});

test('every scenario gives a short sentence that fits Agora speak (512 bytes)', () => {
  for (const def of Object.values(SCENARIOS)) {
    const m = def.metrics[0];
    const s = recoveryAnnouncement('Priya', m.label, fmtMetric(m, m.base), fmtMetric(m, m.base));
    assert.ok(Buffer.byteLength(s) < 512, def.id);
    assert.doesNotMatch(s, /%|⟦/, def.id);
  }
});
