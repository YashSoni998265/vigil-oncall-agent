import { test } from 'node:test';
import assert from 'node:assert/strict';
import { approvalNamesOtherAction, classifyApproval } from '../../lib/server/approval';

// An engineer under stress may answer in Hindi or Hinglish. Approvals in Hindi must work, and every
// Hindi "no", "wait", "maybe" or question must stay a refusal: a "no" always wins over a "yes".

test('Hindi and Hinglish approvals are a clear yes', () => {
  for (const s of ['Haan, kar do.', 'Haan ji, flag band kar do', 'Theek hai, rollback kar do', 'Bilkul, Cashly pe fail over kar do', 'ok kar do', 'Thik hai, pause kar do']) {
    assert.equal(classifyApproval(s).ok, true, s);
  }
});

test('Hindi no, wait and "don\'t" never approve, even next to a yes word', () => {
  for (const s of ['Nahi, abhi mat karo', 'Mat karo', 'Ruko ek minute', 'Rehne do', 'Abhi nahi', 'haan ruko', 'nahin, kar do mat']) {
    const r = classifyApproval(s);
    assert.equal(r.ok, false, s);
    assert.equal(r.ok === false && r.reason, 'negative', s);
  }
});

test('Hindi questions and hedges are not approvals', () => {
  for (const s of ['Kya rollback kar du?', 'kya dikkat hai', 'rollback kar du kya', 'Kaise fix karein', 'kyun fail ho raha hai']) {
    const r = classifyApproval(s);
    assert.equal(r.ok === false && r.reason, 'question', s);
  }
  const hedge = classifyApproval('Shayad, kar do');
  assert.equal(hedge.ok === false && hedge.reason, 'hedge');
});

test('English approvals behave exactly as before', () => {
  assert.equal(classifyApproval('Yes, roll it back.').ok, true);
  assert.equal(classifyApproval('Okay, turn the flag off.').ok, true);
  assert.equal(classifyApproval('Do it.').ok, true);
  const no = classifyApproval('No, wait.');
  assert.equal(no.ok === false && no.reason, 'negative');
  const q = classifyApproval('Should we roll back?');
  assert.equal(q.ok === false && q.reason, 'question');
});

test('a Hindi approval that names another fix never authorises this one', () => {
  assert.equal(approvalNamesOtherAction('Haan, flag band kar do', 'disable_feature_flag'), null);
  assert.equal(approvalNamesOtherAction('Haan, rollback kar do', 'disable_feature_flag'), 'rollback_deploy');
  assert.equal(approvalNamesOtherAction('Haan, kar do', 'pause_job'), null);
});
