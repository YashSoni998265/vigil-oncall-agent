import type { CaptionLine } from '@/lib/types';

// Spoken approval, checked in code. The model must quote the engineer's words, and the
// server checks two things before any production change:
//   1. the words are a clear approval (not a question, a hedge or a "no / wait"), and
//   2. a human really said or typed them in the last APPROVAL_WINDOW_MS of the live transcript.

export const APPROVAL_WINDOW_MS = 120_000;

// English plus Hindi and Hinglish as speech recognition writes them (Roman script). A "no" always
// wins over a "yes" in the same words: "mat karo" (don't) or "abhi nahi" (not now) never approve.
const AFFIRM =
  /\b(yes|yeah|yep|yup|ya|sure|ok|okay|alright|go ahead|go for it|do it|do that|proceed|approved?|approve it|confirm(ed)?|please do|let'?s do it|let'?s go|roll (it )?back|rollback|disable (it|the flag)|turn (it|the flag) off|switch (it|the flag) off|fail ?over|pause (it|the job)|cancel (it|the query)|haan|han|ha|haanji|haan ji|ji haan|theek hai|thik hai|theek he|thik he|bilkul|zaroor|jaroor|kar do|kardo|kar dijiye|kar dijie|kijiye|karo|chalo|chaliye|ho jaye)\b/i;
const NEGATE =
  /\b(no|nope|nah|don'?t|do not|wait|hold on|hold off|stop|not yet|never ?mind|cancel that|abort|nahi|nahin|nai|mat|ruko|ruk jao|ruk jaiye|thehro|rehne do|rahne do|na karo|na kare|ek minute|ek second|ek sec)\b/i;
const HEDGE = /\b(maybe|perhaps|not sure|i guess|might|let me think|hmm+|probably|i think so|shayad|lagta hai|dekhte hain|sochte hain)\b/i;
const QUESTION_START =
  /^(should|shall|can|could|would|will|do|does|did|is|are|was|what|why|how|which|who|when|where|kya|kyun|kyon|kaise|kab|kaun|kahan|kitna|kitni|kitne|kis|kisne)\b/i;
// Hinglish questions often end with "kya": "rollback kar du kya".
const QUESTION_END = /\bkya\s*\??\s*$/i;

// Hindi mode: speech recognition runs in Hindi (hi-IN) and writes everything in Devanagari, Hindi words
// and English ones alike ("Okay, turn the flag off." arrives as "ओके, टर्न द फ्लैग ऑफ।"). Same rules,
// and a "no" still wins over a "yes": "मत करो" (don't) or "रुको" (wait) never approve. English said in
// Hindi mode must be judged as in English mode, so the English no, wait, hedge and question words are
// here too, spelled the way Hindi recognition writes them ("नॉट श्योर", not sure, is never a yes).
// \b only knows a-z, so a Devanagari word is matched whole: no letter or vowel sign may touch it.
// These are tested against normalizeWords(text), so punctuation and extra spaces never get in the way.
function devanagari(phrases: readonly string[], at: { start?: boolean; end?: boolean } = {}): RegExp {
  // NFC, like normalizeWords: "ज़" written as one code point or as ज plus a nukta match either way.
  const alt = phrases.map((p) => p.normalize('NFC')).join('|');
  return new RegExp(`${at.start ? '^' : ''}(?<![\\p{L}\\p{M}])(?:${alt})(?![\\p{L}\\p{M}])${at.end ? '$' : ''}`, 'u');
}

const AFFIRM_HI = devanagari([
  'हाँ', 'हां', 'हा', 'हाँजी', 'हांजी', 'जी हाँ', 'जी हां', 'ठीक है', 'ठीक हे', 'बिल्कुल', 'बिलकुल', 'ज़रूर', 'जरूर',
  'कर दो', 'करदो', 'कर दीजिए', 'कर दीजिये', 'कीजिए', 'कीजिये', 'करो', 'चलो',
  // English: okay, yes, sure, go ahead, do it, proceed
  'ओके', 'ओकेय', 'यस', 'येस', 'श्योर', 'गो अहेड', 'डू इट', 'प्रोसीड',
]);
const NEGATE_HI = devanagari([
  'नहीं', 'नही', 'मत', 'रुको', 'रुकिए', 'रुकिये', 'रुकें', 'रुक जाओ', 'रुक जाइए', 'रुक जाइये', 'ठहरो', 'रहने दो',
  'ना करो', 'ना करें', 'ना करे', 'एक मिनट', 'एक सेकंड', 'एक सेक',
  // English: no, nope, nah, wait, hold, stop, don't, do not, not yet, never mind, cancel that, abort
  'नो', 'नोप', 'नाह', 'वेट', 'होल्ड', 'स्टॉप', 'डोंट', 'डॉन्ट', 'डोन्ट', 'डू नॉट', 'नॉट येट', 'नेवर माइंड', 'कैंसल दैट', 'अबॉर्ट',
]);
const HEDGE_HI = devanagari([
  'शायद', 'लगता है', 'देखते हैं', 'सोचते हैं', 'पता नहीं',
  // English: maybe, perhaps, not sure, I guess, I think so, probably, might, let me think, hmm
  'मेबी', 'परहैप्स', 'नॉट श्योर', 'आई गेस', 'आई थिंक सो', 'प्रोबेबली', 'माइट', 'लेट मी थिंक', 'हम्म', 'हम्मम', 'ह्म्म',
]);
const QUESTION_START_HI = devanagari(
  [
    'क्या', 'क्यों', 'क्यूँ', 'क्यूं', 'कैसे', 'कब', 'कौन', 'कहाँ', 'कहां', 'कितना', 'कितनी', 'कितने', 'किस', 'किसने',
    // English: should, shall, can, could, would, will, do, does, did, is, are, was, what, why, how, which, who, when, where
    'शुड', 'शैल', 'कैन', 'कुड', 'वुड', 'विल', 'डू', 'डज़', 'डज', 'डिड', 'इज़', 'इज', 'आर', 'वॉज़', 'वाज़',
    'व्हाट', 'व्हाई', 'हाउ', 'व्हिच', 'हू', 'व्हेन', 'व्हेयर',
  ],
  { start: true },
);
// Hindi questions often end with क्या: "रोलबैक करूँ क्या" (shall I roll back?).
const QUESTION_END_HI = devanagari(['क्या'], { end: true });
// "डू इट" (do it) is an order, not a question, as in English.
const IMPERATIVE_DO_HI = devanagari(['डू इट', 'डू दैट', 'डू दिस', 'डू सो'], { start: true });

/**
 * Lowercase words separated by single spaces: punctuation (the Devanagari danda "।" too) becomes a space.
 * Letters, vowel signs and digits of any script are kept, so Devanagari survives; English is unchanged.
 */
export function normalizeWords(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[’']/g, "'")
    // Zero-width (non-)joiners only shape Devanagari letters; they never split a word.
    .replace(/[\u200C\u200D]/g, '')
    .replace(/[^\p{L}\p{M}\p{N}'\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export type ApprovalVerdict =
  | { ok: true; matched: CaptionLine }
  | { ok: false; reason: 'empty' | 'question' | 'negative' | 'hedge' | 'not_affirmative' | 'not_heard'; message: string };

export function classifyApproval(raw: string): { ok: true } | { ok: false; reason: 'empty' | 'question' | 'negative' | 'hedge' | 'not_affirmative'; message: string } {
  const text = raw.trim();
  if (!text) return { ok: false, reason: 'empty', message: 'No approval was given.' };
  const words = normalizeWords(text);
  // Each script has its own patterns: the English ones never match Devanagari, and the other way round.
  const imperativeDo = /^do (it|that|this|so)\b/.test(words) || IMPERATIVE_DO_HI.test(words);
  const questionStart = QUESTION_START.test(words) || QUESTION_START_HI.test(words);
  if (/\?\s*$/.test(text) || (questionStart && !imperativeDo) || QUESTION_END.test(words) || QUESTION_END_HI.test(words)) {
    return { ok: false, reason: 'question', message: 'That was a question, not an approval.' };
  }
  if (NEGATE.test(text) || NEGATE_HI.test(words)) return { ok: false, reason: 'negative', message: 'The engineer said no or asked to wait.' };
  if (HEDGE.test(text) || HEDGE_HI.test(words)) return { ok: false, reason: 'hedge', message: 'The engineer sounded unsure.' };
  if (!AFFIRM.test(text) && !AFFIRM_HI.test(words)) return { ok: false, reason: 'not_affirmative', message: 'Those words are not a clear yes.' };
  return { ok: true };
}

function overlap(quote: string, line: string): number {
  const q = normalizeWords(quote).split(' ').filter(Boolean);
  if (q.length === 0) return 0;
  const words = new Set(normalizeWords(line).split(' '));
  return q.filter((w) => words.has(w)).length / q.length;
}

/**
 * Checks the model's quote against what a human actually said or typed recently.
 * The matching transcript line must itself be a clear approval.
 */
export function verifyApproval(quote: string, transcript: CaptionLine[], now: number): ApprovalVerdict {
  const verdict = classifyApproval(quote);
  if (!verdict.ok) return verdict;
  // Only the on-call engineer's own words (spoken or typed) can approve. Teammates may ask Vigil
  // questions, but their lines never count: one voice in command.
  const recent = transcript.filter((l) => l.who === 'engineer' && !l.usedFor && now - Date.parse(l.at) <= APPROVAL_WINDOW_MS);
  const q = normalizeWords(quote);
  const match = [...recent].reverse().find((l) => {
    const line = normalizeWords(l.text);
    if (!line) return false;
    const contains = line.includes(q) || q.includes(line);
    return (contains || overlap(quote, l.text) >= 0.6) && classifyApproval(l.text).ok;
  });
  if (!match) {
    return {
      ok: false,
      reason: 'not_heard',
      message: 'No matching approval from the engineer in the last two minutes of the call.',
    };
  }
  return { ok: true, matched: match };
}

// An approval that names a different action never authorises this one
// ("yes, roll it back" cannot switch off a flag). A generic yes ("yes, do it") is fine.
// Each action's words in English (tested on the quote) and in Devanagari (tested on its normalized words).
const ACTION_WORDS: Record<string, { en: RegExp; hi: RegExp }> = {
  rollback_deploy: {
    en: /\b(roll(ing)? (it |that |this )?back|rollback|revert)\b/i,
    hi: devanagari(['रोलबैक', 'रोल बैक', 'रोल इट बैक', 'रोल दैट बैक', 'रोल दिस बैक', 'रिवर्ट']),
  },
  disable_feature_flag: {
    en: /\b(flag|disable|turn(ing)? (it |that )?off|switch(ing)? (it |that )?off|kill switch)\b/i,
    hi: devanagari(['फ्लैग', 'फ़्लैग', 'डिसेबल', 'टर्न ऑफ', 'टर्न इट ऑफ', 'टर्न दैट ऑफ', 'स्विच ऑफ', 'स्विच इट ऑफ', 'स्विच दैट ऑफ', 'किल स्विच']),
  },
  failover_provider: {
    en: /\b(fail ?over|cashly|backup provider|switch provider)\b/i,
    hi: devanagari(['फेलओवर', 'फेल ओवर', 'कैशली', 'कैश्ली', 'बैकअप प्रोवाइडर', 'स्विच प्रोवाइडर']),
  },
  pause_job: { en: /\b(pause|stop the job|the job|report)\b/i, hi: devanagari(['पॉज़', 'पॉज', 'जॉब', 'रिपोर्ट']) },
  cancel_query: { en: /\b(cancel|kill)( the)? query\b|\bquery\b/i, hi: devanagari(['क्वेरी', 'कैंसल']) },
  scale_service: { en: /\b(scale|replica|more pods|add capacity)\b/i, hi: devanagari(['स्केल', 'रेप्लिका']) },
  restart_service: { en: /\b(restart|reboot|bounce)\b/i, hi: devanagari(['रीस्टार्ट', 'रिस्टार्ट', 'रीबूट', 'बाउंस']) },
};

export function approvalNamesOtherAction(quote: string, action: string): string | null {
  const words = normalizeWords(quote);
  const names = (w: { en: RegExp; hi: RegExp }) => w.en.test(quote) || w.hi.test(words);
  const mine = ACTION_WORDS[action];
  if (mine && names(mine)) return null;
  for (const [other, w] of Object.entries(ACTION_WORDS)) {
    if (other !== action && names(w)) return other;
  }
  return null;
}
