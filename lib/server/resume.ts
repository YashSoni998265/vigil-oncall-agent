import 'server-only';
import type { Sandbox } from '@/lib/types';

// A voice reconnect in the middle of a call: Vigil's voice stalled (her words arrived but the audio
// stopped), so the call screen swapped in a fresh agent on the same call. The fresh agent must not
// greet again from the top: it says it is back, and it gets the recent conversation for context.

const MARK = /⟦[a-z]+⟧/g;

/** What the fresh agent says first. English letters only: the voice reads them in either language. */
export function resumeGreeting(sb: Sandbox): string {
  if (sb.language === 'hi') {
    return `Sorry ${sb.engineer}, meri awaaz ek pal ke liye chali gayi thi. Main wapas aa gayi hoon. Kya aap phir se bol sakte hain?`;
  }
  return `Sorry ${sb.engineer}, my voice cut out for a moment. I'm back on the line. Could you say that again?`;
}

/** Added to the fresh agent's instructions: the call so far, so it carries on instead of starting over. */
export function resumeContext(sb: Sandbox): string {
  const who = (w: string) => (w === 'agent' ? 'You (Vigil)' : w === 'teammate' ? 'Teammate' : sb.engineer);
  const lines = (sb.transcript ?? [])
    .slice(-8)
    .map((l) => ({ who: who(l.who), text: String(l.text).replace(MARK, '').replace(/\s+/g, ' ').trim().slice(0, 220) }))
    .filter((l) => l.text)
    .map((l) => `- ${l.who}: ${l.text}`);
  const so = lines.length ? `\nThe conversation so far (oldest first):\n${lines.join('\n')}` : '';
  return `This call is already in progress. Your voice cut out for a moment and you just rejoined the same call: do not greet again or repeat the opening. The incident facts above are current.${so}\nCarry on from there. If ${sb.engineer} repeats a request, handle it as usual.`;
}
