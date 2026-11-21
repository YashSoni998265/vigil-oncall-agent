import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeContext, resumeGreeting } from '../../lib/server/resume';
import { bilingualInstructions } from '../../lib/server/greeting-hi';
import type { Sandbox } from '../../lib/types';

// A mid-call voice reconnect: the fresh agent says it is back (never the opening greeting again) and
// gets the conversation so far. And one call understands English, Hindi and Hinglish.

const DEVANAGARI = /[ऀ-ॿ]/;

function sb(extra: Partial<Sandbox> = {}): Sandbox {
  return {
    id: 'abcdef1234',
    createdAt: '2026-11-21T04:30:00Z',
    updatedAt: '2026-11-21T04:33:00Z',
    version: 1,
    engineer: 'Yash Soni',
    incident: null,
    call: null,
    actions: [],
    channel: [],
    transcript: [],
    callsUsed: 1,
    escalatedTo: null,
    incidentCount: 1,
    history: [],
    ...extra,
  } as Sandbox;
}

test('resume greeting: short, says she is back, English letters only in both languages', () => {
  const en = resumeGreeting(sb());
  assert.match(en, /^Sorry Yash Soni, my voice cut out for a moment\. I'm back on the line\. Could you say that again\?$/);
  const hi = resumeGreeting(sb({ language: 'hi' }));
  assert.match(hi, /meri awaaz ek pal ke liye chali gayi thi\. Main wapas aa gayi hoon/);
  for (const g of [en, hi]) {
    assert.ok(!DEVANAGARI.test(g), 'the Indian-English voice must never get Devanagari');
    assert.ok(!/severity one/i.test(g), 'never the opening greeting again');
  }
});

test('resume context: the last eight lines, oldest first, internal marks removed, no restart', () => {
  const transcript = Array.from({ length: 10 }, (_, i) => ({
    at: `2026-11-21T04:3${i}:00Z`,
    who: (i % 2 ? 'engineer' : 'agent') as 'agent' | 'engineer',
    text: i === 9 ? 'हाँ, स्टेटस पेज में अपडेट करके incident चैनल में पोस्ट कर दो ⟦system⟧' : `line ${i}`,
  }));
  const text = resumeContext(sb({ transcript }));
  assert.match(text, /do not greet again or repeat the opening/);
  assert.doesNotMatch(text, /line 0|line 1\b/, 'only the last eight lines');
  assert.match(text, /- You \(Vigil\): line 2\n- Yash Soni: line 3/);
  assert.match(text, /- Yash Soni: हाँ, स्टेटस पेज में अपडेट करके incident चैनल में पोस्ट कर दो\n/);
  assert.doesNotMatch(text, /⟦/);
  assert.match(text, /If Yash Soni repeats a request, handle it as usual\.$/);
  // An empty call still gets the instruction, without an empty list.
  assert.doesNotMatch(resumeContext(sb()), /conversation so far/);
});

test('one call, two languages: English (even in Devanagari) gets English, Hindi gets Hinglish', () => {
  const text = bilingualInstructions('Priya');
  assert.match(text, /one call handles English, Hindi and Hinglish/);
  assert.match(text, /"ओके, टर्न द फ्लैग ऑफ" means "okay, turn the flag off"/);
  assert.match(text, /English words, even written in Devanagari, get an English reply; Hindi or mixed Hindi and English gets natural Hinglish/);
  assert.match(text, /Never write Devanagari yourself/);
  assert.match(text, /in Devanagari if that is how they arrived, as approval_quote\. Never translate them/);
});
