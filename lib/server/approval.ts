import type { CaptionLine } from '@/lib/types';

// Spoken approval, checked in code. The model must quote the engineer's words, and the
// server checks two things before any production change:
//   1. the words are a clear approval (not a question, a hedge or a "no / wait"), and
//   2. a human really said or typed them in the last APPROVAL_WINDOW_MS of the live transcript.

export const APPROVAL_WINDOW_MS = 120_000;

const AFFIRM =
  /\b(yes|yeah|yep|yup|ya|sure|ok|okay|alright|go ahead|go for it|do it|do that|proceed|approved?|approve it|confirm(ed)?|please do|let'?s do it|let'?s go|roll (it )?back|rollback|disable (it|the flag)|turn (it|the flag) off|switch (it|the flag) off|fail ?over|pause (it|the job)|cancel (it|the query)|haan|han|ha|theek hai|kar do|karo)\b/i;
const NEGATE =
  /\b(no|nope|nah|don'?t|do not|wait|hold on|hold off|stop|not yet|never ?mind|cancel that|abort|nahi|mat|ruko)\b/i;
const HEDGE = /\b(maybe|perhaps|not sure|i guess|might|let me think|hmm+|probably|i think so)\b/i;
const QUESTION_START =
  /^(should|shall|can|could|would|will|do|does|did|is|are|was|what|why|how|which|who|when|where)\b/i;

export function normalizeWords(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9'\s]/g, ' ')
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
  const imperativeDo = /^do (it|that|this|so)\b/.test(words);
  if (/\?\s*$/.test(text) || (QUESTION_START.test(words) && !imperativeDo)) {
    return { ok: false, reason: 'question', message: 'That was a question, not an approval.' };
  }
  if (NEGATE.test(text)) return { ok: false, reason: 'negative', message: 'The engineer said no or asked to wait.' };
  if (HEDGE.test(text)) return { ok: false, reason: 'hedge', message: 'The engineer sounded unsure.' };
  if (!AFFIRM.test(text)) return { ok: false, reason: 'not_affirmative', message: 'Those words are not a clear yes.' };
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
const ACTION_WORDS: Record<string, RegExp> = {
  rollback_deploy: /\b(roll(ing)? (it |that |this )?back|rollback|revert)\b/i,
  disable_feature_flag: /\b(flag|disable|turn(ing)? (it |that )?off|switch(ing)? (it |that )?off|kill switch)\b/i,
  failover_provider: /\b(fail ?over|cashly|backup provider|switch provider)\b/i,
  pause_job: /\b(pause|stop the job|the job|report)\b/i,
  cancel_query: /\b(cancel|kill)( the)? query\b|\bquery\b/i,
  scale_service: /\b(scale|replica|more pods|add capacity)\b/i,
  restart_service: /\b(restart|reboot|bounce)\b/i,
};

export function approvalNamesOtherAction(quote: string, action: string): string | null {
  const mine = ACTION_WORDS[action];
  if (mine?.test(quote)) return null;
  for (const [other, re] of Object.entries(ACTION_WORDS)) {
    if (other !== action && re.test(quote)) return other;
  }
  return null;
}
