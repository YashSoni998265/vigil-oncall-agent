import 'server-only';
import { fmtClock } from '@/lib/sim';
import type { Sandbox } from '@/lib/types';

// Hindi mode: the engineer picked हिंदी in the console. Speech recognition runs in Hindi (hi-IN), so
// their words arrive in Devanagari, and Vigil talks in Hinglish written in English letters, which the
// Indian-English voice reads naturally. Vigil's voice is a woman's: feminine forms for herself.

/**
 * Vigil's first sentence in Hinglish: the diagnosis and the recommended fix, never just the alert.
 * Only for the first call about a fresh incident. A callback, a call after a fix was tried, or a repeat
 * of an incident Vigil remembers returns null, and the caller falls back to the English greeting.
 */
export function buildGreetingHi(sb: Sandbox, _now: number): string | null {
  const inc = sb.incident;
  if (!inc || sb.call?.kind === 'callback' || inc.remediations.length > 0 || inc.learnedFrom) return null;
  const time = fmtClock(inc.faultAt);
  const hello = `Hi ${sb.engineer}, main Vigil bol rahi hoon, severity one incident hai.`;

  switch (inc.scenario) {
    case 'bad_deploy':
      return `${hello} ${time} se 18 percent orders ka checkout fail ho raha hai, Arjun ke payments-service 4.2.1 deploy ke ek minute baad. Logs new coupon engine ki taraf ishara kar rahe hain. Rollback se checkout toot jayega, kyunki 4.2.1 ne database migration chalaya hai. Isliye main recommend karti hoon ki new-coupon-engine feature flag switch off karein, pehle 10 percent traffic pe. Shuru karoon?`;
    case 'upi_provider':
      return `${hello} UPI payments fail ho rahe hain: ${time} pe success 61 percent tak gir gaya. Hamara provider PayNova time out ho raha hai, aur backup provider Cashly healthy hai. Main recommend karti hoon ki UPI ko Cashly pe fail over karein. Fail over kar doon?`;
    case 'db_overload':
      return `${hello} ${time} se orders database 98 percent CPU pe hai aur connections khatam ho gaye hain. Usse ek minute pehle merchant weekly report job ne full table scan shuru kiya tha. Main recommend karti hoon ki us job ko pause karein. Pause kar doon?`;
    default:
      return null;
  }
}

/** Added after buildInstructions when the engineer chose Hindi. It replaces the English-first language rule. */
export function hindiModeInstructions(name: string): string {
  return `Hindi mode. ${name} chose Hindi for this call, and this replaces the language rule above:
- Reply in natural Hinglish by default, the way Indian engineers talk: Hindi sentences written only in Roman (English) letters, never in Devanagari script, with technical words kept in English (rollback, feature flag, status page, error rate). Your voice is a woman's, so use feminine forms for yourself: "main check kar rahi hoon", "maine flag band kar diya hai". Facts, numbers and names stay exactly the same.
- ${name}'s speech reaches you in Devanagari script, and English words they say arrive transliterated into Devanagari too: "ओके, टर्न द फ्लैग ऑफ" means "okay, turn the flag off". Understand both.
- A Hindi yes (हाँ, ठीक है, कर दो) approves like an English one; नहीं, मत करो, रुको or शायद never approve. When ${name} approves a change, pass their words exactly as they arrived, in Devanagari, as approval_quote. Never translate them or rewrite them in English letters.
- If ${name} switches to English, keep answering in Hinglish unless they ask you to speak English.`;
}

/**
 * Added after buildInstructions on every English-first call. Speech recognition runs in Hindi (hi-IN) by
 * default because it also hears English, so one call understands English, Hindi and Hinglish; Indian
 * engineers mix them. Vigil answers in the language the engineer used.
 */
export function bilingualInstructions(name: string): string {
  return `Listening in English and Hindi. ${name}'s speech reaches you through Hindi speech recognition, so one call handles English, Hindi and Hinglish. Hindi arrives in Devanagari script; English words usually arrive transliterated into Devanagari too ("ओके, टर्न द फ्लैग ऑफ" means "okay, turn the flag off"; "व्हाट इज द रिस्क" means "what is the risk"), sometimes in English letters. Understand all of it.
- Reply in the language ${name} used: English words, even written in Devanagari, get an English reply; Hindi or mixed Hindi and English gets natural Hinglish (the language rule above). Never write Devanagari yourself.
- When ${name} approves a change, pass their words exactly as they arrived, in Devanagari if that is how they arrived, as approval_quote. Never translate them or rewrite them in English letters.`;
}
