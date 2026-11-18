import { test } from 'node:test';
import assert from 'node:assert/strict';
import { approvalNamesOtherAction, classifyApproval, verifyApproval } from '../../lib/server/approval';
import type { CaptionLine } from '../../lib/types';

const now = Date.parse('2026-11-21T09:30:00Z');
const line = (who: CaptionLine['who'], text: string, secondsAgo = 5, extra: Partial<CaptionLine> = {}): CaptionLine => ({
  at: new Date(now - secondsAgo * 1000).toISOString(),
  who,
  text,
  ...extra,
});

test('clear approvals pass', () => {
  for (const yes of ['Yes, roll it back.', 'yes do it', 'Do it.', 'Do it now', 'Okay, turn the flag off.', 'Go ahead', 'Approved', 'Yes, fail over to Cashly.', 'Haan, kar do']) {
    assert.equal(classifyApproval(yes).ok, true, yes);
  }
});

test('questions, hedges and "no / wait" never count as approval', () => {
  const cases: [string, string][] = [
    ['Should we roll back?', 'question'],
    ['should we roll back', 'question'],
    ['Can you turn the flag off', 'question'],
    ['Do we need to roll back', 'question'],
    ['Do it?', 'question'],
    ['No, wait.', 'negative'],
    ["Don't do that yet", 'negative'],
    ['Yes, but hold on', 'negative'],
    ['Maybe, I guess', 'hedge'],
    ['Interesting', 'not_affirmative'],
    ['', 'empty'],
  ];
  for (const [text, reason] of cases) {
    const v = classifyApproval(text);
    assert.equal(v.ok, false, text);
    if (!v.ok) assert.equal(v.reason, reason, text);
  }
});

test('the quote must match something a human actually said', () => {
  const transcript = [line('agent', 'Shall I roll back to 4.2.0?', 9), line('engineer', 'Yes, roll it back.', 4)];
  assert.equal(verifyApproval('Yes, roll it back', transcript, now).ok, true);
  // A fabricated approval (never said) is refused.
  const fake = verifyApproval('Yes, restart the database', transcript, now);
  assert.equal(fake.ok, false);
  // The agent's own words are not an approval.
  const own = verifyApproval('Shall I roll back to 4.2.0', [line('agent', 'Yes, roll it back.', 3)], now);
  assert.equal(own.ok, false);
});

test('typed approvals count like spoken ones', () => {
  const transcript = [line('engineer', 'yes do it', 2, { typed: true })];
  assert.equal(verifyApproval('yes do it', transcript, now).ok, true);
});

test('stale approvals (older than two minutes) are refused', () => {
  const transcript = [line('engineer', 'Yes, roll it back.', 150)];
  const v = verifyApproval('Yes, roll it back', transcript, now);
  assert.equal(v.ok, false);
  if (!v.ok) assert.equal(v.reason, 'not_heard');
});

test('one yes authorises one change', () => {
  const transcript = [line('engineer', 'Yes, roll it back.', 4, { usedFor: 'rollback_deploy:payments-service' })];
  assert.equal(verifyApproval('Yes, roll it back', transcript, now).ok, false);
});

test('a yes for one action cannot approve a different action', () => {
  assert.equal(approvalNamesOtherAction('Yes, roll it back', 'disable_feature_flag'), 'rollback_deploy');
  assert.equal(approvalNamesOtherAction('Yes, roll it back', 'rollback_deploy'), null);
  assert.equal(approvalNamesOtherAction('Okay, turn the flag off', 'disable_feature_flag'), null);
  assert.equal(approvalNamesOtherAction('yes do it', 'restart_service'), null);
  assert.equal(approvalNamesOtherAction('Yes, pause the job', 'restart_service'), 'pause_job');
});

test('ASR punctuation and case differences still match', () => {
  const transcript = [line('engineer', 'okay turn the flag off', 3)];
  assert.equal(verifyApproval('Okay, turn the flag off.', transcript, now).ok, true);
});
