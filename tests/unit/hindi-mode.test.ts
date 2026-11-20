import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { approvalNamesOtherAction, classifyApproval, normalizeWords, verifyApproval } from '../../lib/server/approval';
import { buildGreetingHi, hindiModeInstructions } from '../../lib/server/greeting-hi';
import { fmtClock } from '../../lib/sim';
import type { CaptionLine, Incident, Sandbox, ScenarioId } from '../../lib/types';

// Hindi mode: the engineer picks हिंदी in the console, speech recognition runs in Hindi (hi-IN), and
// everything they say arrives in Devanagari, English words included ("Okay, turn the flag off." arrives
// as "ओके, टर्न द फ्लैग ऑफ।"). A Devanagari yes must approve; every Devanagari no, wait, maybe or
// question must stay a refusal, and a "no" always wins over a "yes". Vigil answers in Hinglish.

// The engine and the prompt are imported inside tests, after this points the JSON file store at a
// temporary folder: no Redis, no Agora, no network.
process.env.VIGIL_DATA_DIR = mkdtempSync(path.join(tmpdir(), 'vigil-hindi-'));

type Engine = typeof import('../../lib/server/engine');
type Store = typeof import('../../lib/server/store');
type Prompt = typeof import('../../lib/server/prompt');
// tsx may hand back CommonJS modules under `default`; accept both shapes.
const unwrap = <T>(m: T): T => ((m as { default?: T }).default ?? m) as T;

const now = Date.parse('2026-11-21T15:30:00Z');
const line = (who: CaptionLine['who'], text: string, secondsAgo = 5, extra: Partial<CaptionLine> = {}): CaptionLine => ({
  at: new Date(now - secondsAgo * 1000).toISOString(),
  who,
  text,
  ...extra,
});
const DEVANAGARI = /[\u0900-\u097F]/;

test('Devanagari approvals are a clear yes, Hindi words and transliterated English alike', () => {
  for (const s of [
    'हाँ, कर दो',
    'हां, कर दो',
    'ठीक है, फ्लैग बंद कर दो',
    'ओके, टर्न द फ्लैग ऑफ।',
    'हाँ, फ्लैग बंद कर दो।',
    'जी हाँ, रोलबैक कर दो',
    'बिल्कुल, कैशली पे फेलओवर कर दो',
    'यस, रोल इट बैक।',
    'डू इट',
    'चलो, पॉज़ करो',
    // Whole words only: मत inside मतलब ("I mean") or सहमत ("agreed") is not "don't".
    'हाँ, मतलब कर दो',
    'हाँ, सहमत हूँ, कर दो',
  ]) {
    assert.equal(classifyApproval(s).ok, true, s);
  }
  // ज़ written as one code point or as ज plus a nukta: both are ज़रूर ("of course").
  assert.equal(classifyApproval('\u095Bरूर, कर दो').ok, true);
  assert.equal(classifyApproval('\u091C\u093Cरूर, कर दो').ok, true);
});

test('a Devanagari no, wait or "don\'t" always wins, even next to a yes', () => {
  for (const s of ['मत करो', 'नहीं, अभी नहीं', 'रुको एक मिनट', 'हाँ रुको', 'हाँ, पर एक मिनट', 'रहने दो', 'पता नहीं', 'ओके, वेट', 'यस, बट होल्ड ऑन', 'नो, डोंट डू इट', 'ओके, नॉट येट']) {
    const r = classifyApproval(s);
    assert.equal(r.ok === false && r.reason, 'negative', s);
  }
});

test('Devanagari questions and hedges are not approvals', () => {
  // Hindi questions, and English ones as Hindi recognition writes them ("should we do it", "are you sure").
  for (const s of ['क्या रोलबैक कर दूँ', 'रोलबैक करूँ क्या', 'क्या फ्लैग बंद कर दूँ?', 'कैसे ठीक करें', 'भाई, क्या दिक्कत है?', 'शुड वी डू इट', 'आर यू श्योर', 'डू इट?']) {
    const r = classifyApproval(s);
    assert.equal(r.ok === false && r.reason, 'question', s);
  }
  // "Not sure" contains "sure" (श्योर), and must still never be a yes.
  for (const s of ['शायद कर दो', 'लगता है ठीक है', 'मेबी, कर दो', 'नॉट श्योर', 'ओके, आई गेस']) {
    const r = classifyApproval(s);
    assert.equal(r.ok === false && r.reason, 'hedge', s);
  }
  const r = classifyApproval('फ्लैग के बारे में बताओ');
  assert.equal(r.ok === false && r.reason, 'not_affirmative');
});

test('normalizeWords keeps Devanagari and drops punctuation; English is unchanged', () => {
  assert.equal(normalizeWords('हाँ, फ्लैग बंद कर दो।'), 'हाँ फ्लैग बंद कर दो');
  assert.equal(normalizeWords('ओके,  टर्न द फ्लैग ऑफ!'), 'ओके टर्न द फ्लैग ऑफ');
  // A zero-width joiner only shapes the letters; it never splits a word.
  assert.equal(normalizeWords('क्\u200Dया'), 'क्या');
  assert.equal(normalizeWords('Okay, turn the flag off.'), 'okay turn the flag off');
  assert.equal(normalizeWords('Don’t   do THAT!'), "don't do that");
  assert.equal(normalizeWords('Yes — roll it back to 4.2.0'), 'yes roll it back to 4 2 0');
});

test('English approvals behave exactly as before', () => {
  for (const s of ['Yes, roll it back.', 'Okay, turn the flag off.', 'Do it.', 'Haan, kar do']) assert.equal(classifyApproval(s).ok, true, s);
  const no = classifyApproval('No, wait.');
  assert.equal(no.ok === false && no.reason, 'negative');
  const q = classifyApproval('Should we roll back?');
  assert.equal(q.ok === false && q.reason, 'question');
  const hedge = classifyApproval('Maybe, I guess');
  assert.equal(hedge.ok === false && hedge.reason, 'hedge');
  assert.equal(approvalNamesOtherAction('Yes, roll it back', 'disable_feature_flag'), 'rollback_deploy');
  assert.equal(approvalNamesOtherAction('Okay, turn the flag off', 'disable_feature_flag'), null);
  assert.equal(verifyApproval('Yes, roll it back', [line('engineer', 'Yes, roll it back.', 4)], now).ok, true);
});

test('a Devanagari approval that names another fix never authorises this one', () => {
  assert.equal(approvalNamesOtherAction('हाँ, रोलबैक कर दो', 'disable_feature_flag'), 'rollback_deploy');
  assert.equal(approvalNamesOtherAction('हाँ, फ्लैग बंद कर दो', 'disable_feature_flag'), null);
  assert.equal(approvalNamesOtherAction('हाँ, फ़्लैग बंद कर दो', 'disable_feature_flag'), null);
  assert.equal(approvalNamesOtherAction('ओके, टर्न द फ्लैग ऑफ', 'disable_feature_flag'), null);
  assert.equal(approvalNamesOtherAction('ओके, टर्न द फ्लैग ऑफ', 'rollback_deploy'), 'disable_feature_flag');
  assert.equal(approvalNamesOtherAction('यस, कैशली पे फेलओवर कर दो', 'rollback_deploy'), 'failover_provider');
  assert.equal(approvalNamesOtherAction('हाँ, जॉब पॉज़ कर दो', 'restart_service'), 'pause_job');
  assert.equal(approvalNamesOtherAction('हाँ, सर्विस रीस्टार्ट कर दो', 'pause_job'), 'restart_service');
  // A generic yes names no fix, so it is fine for the fix Vigil proposed.
  assert.equal(approvalNamesOtherAction('हाँ, कर दो', 'pause_job'), null);
});

test('verifyApproval matches a Devanagari quote to what the engineer actually said', () => {
  const transcript = [line('agent', 'Shuru karoon?', 9), line('engineer', 'हाँ, फ्लैग बंद कर दो।', 4)];
  const v = verifyApproval('हाँ, फ्लैग बंद कर दो', transcript, now);
  assert.equal(v.ok, true);
  assert.equal(v.ok && v.matched.text, 'हाँ, फ्लैग बंद कर दो।');
  // Punctuation and spacing from the model or the recognizer do not matter.
  assert.equal(verifyApproval('हाँ फ्लैग बंद  कर दो', transcript, now).ok, true);
  // English said in Hindi mode, transliterated, works the same way.
  assert.equal(verifyApproval('ओके, टर्न द फ्लैग ऑफ', [line('engineer', 'ओके, टर्न द फ्लैग ऑफ।', 3)], now).ok, true);

  // Never said: refused.
  const fake = verifyApproval('जी हाँ, कैशली पे फेलओवर करो', transcript, now);
  assert.equal(fake.ok === false && fake.reason, 'not_heard');
  // A teammate's yes, or Vigil's own words, never count.
  assert.equal(verifyApproval('हाँ, फ्लैग बंद कर दो', [line('teammate', 'हाँ, फ्लैग बंद कर दो।')], now).ok, false);
  assert.equal(verifyApproval('हाँ, फ्लैग बंद कर दो', [line('agent', 'हाँ, फ्लैग बंद कर दो।')], now).ok, false);
  // Older than two minutes, or already used for a change: refused.
  assert.equal(verifyApproval('हाँ, फ्लैग बंद कर दो', [line('engineer', 'हाँ, फ्लैग बंद कर दो।', 150)], now).ok, false);
  assert.equal(verifyApproval('हाँ, फ्लैग बंद कर दो', [line('engineer', 'हाँ, फ्लैग बंद कर दो।', 4, { usedFor: 'disable_feature_flag:new-coupon-engine' })], now).ok, false);
  // The line it matches must itself be a clear yes: "हाँ रुको" (yes, wait) contains "हाँ" but is a wait.
  assert.equal(verifyApproval('हाँ', [line('engineer', 'हाँ रुको', 3)], now).ok, false);
});

// ---------------------------------------------------------------------------
// The Hinglish greeting and the Hindi-mode instructions

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

function sandbox(inc: Incident | null, extra: Partial<Sandbox> = {}): Sandbox {
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
    language: 'hi',
    ...extra,
  };
}

const RECOMMENDS: Record<ScenarioId, RegExp[]> = {
  bad_deploy: [/18 percent orders/, /Arjun ke payments-service 4\.2\.1 deploy/, /new coupon engine/, /Rollback se checkout toot jayega, kyunki 4\.2\.1 ne database migration chalaya hai/, /new-coupon-engine feature flag switch off karein, pehle 10 percent traffic pe/, /Shuru karoon\?$/],
  upi_provider: [/success 61 percent/, /PayNova time out ho raha hai/, /Cashly healthy hai/, /UPI ko Cashly pe fail over karein/, /\?$/],
  db_overload: [/98 percent CPU/, /connections khatam/, /merchant weekly report job ne full table scan/, /us job ko pause karein/, /\?$/],
};

test('Hinglish greeting: Roman letters only, feminine forms, the diagnosis and the recommended fix', () => {
  for (const scenario of ['bad_deploy', 'upi_provider', 'db_overload'] as ScenarioId[]) {
    const inc = incident(scenario);
    const greeting = buildGreetingHi(sandbox(inc), now);
    assert.ok(greeting, scenario);
    assert.doesNotMatch(greeting, DEVANAGARI, `${scenario}: Roman letters only`);
    assert.match(greeting, /^Hi Priya, main Vigil bol rahi hoon/, scenario);
    assert.match(greeting, /\brahi\b/, scenario);
    // Vigil's voice is a woman's: never a masculine form for herself.
    assert.doesNotMatch(greeting, /\b(raha hoon|karta hoon|karunga|dunga|sakta hoon)\b/, scenario);
    assert.ok(greeting.includes(fmtClock(inc.faultAt)), `${scenario}: says when it began`);
    for (const re of RECOMMENDS[scenario]) assert.match(greeting, re, scenario);
    // A phone greeting, not a briefing: well under half a minute of speech.
    assert.ok(greeting.split(/\s+/).length <= 80, `${scenario}: ${greeting.split(/\s+/).length} words`);
  }
});

test('Hinglish greeting: a repeat incident, a callback or a call after a fix falls back to English', async () => {
  const learnedFrom = { id: 'INC-2481', fix: 'switching off the new-coupon-engine flag', blocked: null };
  const repeat = sandbox(incident('bad_deploy', { learnedFrom, recommended: 'Switch off the new-coupon-engine feature flag' }));
  assert.equal(buildGreetingHi(repeat, now), null);
  assert.equal(buildGreetingHi(sandbox(incident('upi_provider', { learnedFrom })), now), null);
  const at = new Date(now - 60_000).toISOString();
  const callback = sandbox(incident('bad_deploy'), {
    call: { status: 'active', kind: 'callback', attempt: 1, ringAt: null, retryAt: null, agentId: null, channel: null, engineerUid: null, startedAt: at, lastSeenAt: at, endedAt: null, endReason: null, teammatePaged: null, teammateJoinedAt: null, teammateAnnounced: false },
  });
  assert.equal(buildGreetingHi(callback, now), null);
  const tried = incident('bad_deploy', { remediations: [{ action: 'rollback_deploy', target: 'payments-service', at, outcome: 'failed', effective: false, note: 'blocked' }] });
  assert.equal(buildGreetingHi(sandbox(tried), now), null);
  assert.equal(buildGreetingHi(sandbox(null), now), null);

  // What the call does with null: the English greeting, which knows the remembered incident.
  const { buildGreeting } = unwrap<Prompt>(await import('../../lib/server/prompt'));
  assert.match(buildGreetingHi(repeat, now) ?? buildGreeting(repeat, now), /same failure as incident 2481 earlier/);
});

test('Hindi-mode instructions: Hinglish in Roman letters, Devanagari input, the quote passed as it arrived', () => {
  const text = hindiModeInstructions('Priya');
  assert.match(text, /Priya chose Hindi/);
  assert.match(text, /replaces the language rule above/);
  assert.match(text, /natural Hinglish by default/);
  assert.match(text, /never in Devanagari script/);
  assert.match(text, /technical words kept in English \(rollback, feature flag, status page, error rate\)/);
  assert.match(text, /"main check kar rahi hoon", "maine flag band kar diya hai"/);
  assert.match(text, /"ओके, टर्न द फ्लैग ऑफ" means "okay, turn the flag off"/);
  assert.match(text, /exactly as they arrived, in Devanagari, as approval_quote/);
  assert.match(text, /keep answering in Hinglish unless they ask you to speak English/);
});

// ---------------------------------------------------------------------------
// The language preference on the sandbox (real engine, JSON file store in a temporary folder)

test('the language is saved per sandbox, kept across incidents and a reset, and shown in the view', async () => {
  const engine = unwrap<Engine>(await import('../../lib/server/engine'));
  const store = unwrap<Store>(await import('../../lib/server/store'));
  const sb = await engine.newSandbox('Priya');

  // A sandbox that never chose a language is English, and the view says so.
  assert.equal((await store.readSandbox(sb.id))?.language, undefined);
  assert.equal((await engine.viewSandbox(sb.id))?.view.sandbox.language, 'en');

  assert.equal(await engine.setLanguage(sb.id, 'hi'), true);
  assert.equal((await store.readSandbox(sb.id))?.language, 'hi');
  assert.equal((await engine.viewSandbox(sb.id))?.view.sandbox.language, 'hi');

  // Anything but 'en' or 'hi' is refused and changes nothing.
  for (const bad of ['HI', 'hindi', 'hi-IN', 'fr', '']) assert.equal(await engine.setLanguage(sb.id, bad), false, bad);
  assert.equal((await store.readSandbox(sb.id))?.language, 'hi');

  // Like the engineer's name, it stays for the next incident and across a reset.
  await engine.triggerIncident(sb.id, 'bad_deploy');
  assert.equal((await store.readSandbox(sb.id))?.language, 'hi');
  await engine.resetSandbox(sb.id);
  assert.equal((await store.readSandbox(sb.id))?.language, 'hi');

  assert.equal(await engine.setLanguage(sb.id, 'en'), true);
  assert.equal((await engine.viewSandbox(sb.id))?.view.sandbox.language, 'en');
});
