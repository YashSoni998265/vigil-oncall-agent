import 'server-only';
import { randomBytes } from 'node:crypto';
import {
  DEFAULT_ENGINEER,
  MAX_CALL_SECONDS,
  PEOPLE,
  SCENARIOS,
  fmtClock,
  fmtINRShort,
  fmtInt,
  fmtMetric,
  impactAt,
  isRecovered,
  metricValue,
} from '@/lib/sim';
import type { ActionEntry, CaptionLine, ChannelMessage, Sandbox, SandboxView, ScenarioId } from '@/lib/types';
import { createSandboxRecord, incrementDailyCalls, mutateSandbox, readDailyCalls, readSandbox } from './store';
import { recentChanges, logSignatures } from './world';
import { searchRunbooks } from './runbooks';
import { agentThink, stopAgent } from './agora';

export type Effect = () => Promise<void>;

export async function runEffects(effects: Effect[]): Promise<void> {
  for (const effect of effects) {
    try {
      await effect();
    } catch (error) {
      console.warn('[effect] failed:', error instanceof Error ? error.message : error);
    }
  }
}

export const SYSTEM_UPDATE_MARK = '⟦monitor⟧';
/** Prefix for a question a teammate typed on their phone (injected through the think API). */
export const TEAMMATE_MARK = '⟦teammate⟧';
/** Any of Vigil's internal messages. They come back in Agora's transcript as user turns, but no person said them. */
export const INTERNAL_MARK = /⟦[a-z]+⟧/;
const RING_MS = 30_000;
const RETRY_DELAY_MS = 10_000;
const MAX_RING_ATTEMPTS = 2;
const STALE_CALL_MS = 35_000;
const TEAMMATE_ASK_GAP_MS = 4_000;
const MAX_TEAMMATE_QUESTIONS = 20;
const INVESTIGATION_MS = 3_200;

export const MAX_CALLS_PER_SANDBOX = Number(process.env.MAX_CALLS_PER_SANDBOX ?? 6);
/** The owner's own calls (demos, judges' questions) may run longer than public demo calls. */
export const OWNER_MAX_CALL_SECONDS = Number(process.env.OWNER_MAX_CALL_SECONDS ?? 900);
export const DAILY_CALL_CAP = Number(process.env.DAILY_CALL_CAP ?? 60);

const nowIso = (t = Date.now()) => new Date(t).toISOString();
const uid = () => randomBytes(6).toString('hex');

export function isOwner(key: string | null | undefined): boolean {
  const owner = process.env.OWNER_KEY;
  return Boolean(owner && key && key === owner);
}

export function pushAction(sb: Sandbox, entry: Omit<ActionEntry, 'id' | 'at' | 'phase'> & { at?: string; phase?: ActionEntry['phase'] }): ActionEntry {
  const phase: ActionEntry['phase'] =
    entry.phase ?? (sb.call?.status === 'active' ? 'call' : sb.incident && !sb.call ? 'before' : 'after');
  const full: ActionEntry = { id: uid(), at: entry.at ?? nowIso(), phase, ...entry } as ActionEntry;
  sb.actions.push(full);
  return full;
}

export function pushChannel(sb: Sandbox, author: string, role: ChannelMessage['role'], text: string, at?: string): void {
  sb.channel.push({ id: uid(), at: at ?? nowIso(), author, role, text });
}

// ---------------------------------------------------------------------------
// Sandboxes

export async function newSandbox(engineer?: string, owner = false): Promise<Sandbox> {
  const id = Array.from(randomBytes(10), (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');
  const t = nowIso();
  const sb: Sandbox = {
    id,
    createdAt: t,
    updatedAt: t,
    version: 1,
    engineer: cleanName(engineer) ?? DEFAULT_ENGINEER,
    incident: null,
    call: null,
    actions: [],
    channel: [],
    transcript: [],
    callsUsed: 0,
    escalatedTo: null,
    incidentCount: 0,
    owner,
  };
  await createSandboxRecord(sb);
  return sb;
}

export function cleanName(name: string | undefined | null): string | null {
  const n = (name ?? '').replace(/[^\p{L}\p{M}\s.'-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 24);
  return n.length >= 2 ? n : null;
}

export async function viewSandbox(id: string, ownerKey?: string | null): Promise<{ view: SandboxView; effects: Effect[] } | null> {
  const before = await readSandbox(id);
  if (!before) return null;
  const { sandbox, effects } = await tick(before);
  const owner = isOwner(ownerKey);
  return {
    view: {
      sandbox,
      now: Date.now(),
      limits: {
        callsLeft: owner ? 99 : Math.max(0, MAX_CALLS_PER_SANDBOX - sandbox.callsUsed),
        maxCallSeconds: sandbox.call?.maxSeconds ?? (owner ? OWNER_MAX_CALL_SECONDS : MAX_CALL_SECONDS),
        owner,
      },
    },
    effects,
  };
}

/** Lazy clock: rings, retries, escalation, stale calls, call limits and recovery updates. Runs on every poll. */
export async function tick(sb: Sandbox): Promise<{ sandbox: Sandbox; effects: Effect[] }> {
  const now = Date.now();
  const c = sb.call;
  const inc = sb.incident;
  const needs =
    (c?.status === 'investigating' && c.ringAt && Date.parse(c.ringAt) <= now) ||
    (c?.status === 'ringing' && c.ringAt && now - Date.parse(c.ringAt) > RING_MS) ||
    (c?.status === 'missed' && c.retryAt && Date.parse(c.retryAt) <= now) ||
    (c?.status === 'active' && c.lastSeenAt && now - Date.parse(c.lastSeenAt) > STALE_CALL_MS) ||
    (c?.status === 'active' && c.startedAt && now - Date.parse(c.startedAt) > ((c.maxSeconds ?? MAX_CALL_SECONDS) + 20) * 1000) ||
    (inc && inc.mitigatedAt && !inc.recoveredAt && isRecovered(inc, now)) ||
    (c?.status === 'active' && c.teammateJoinedAt && !c.teammateAnnounced && c.agentId);
  if (!needs) return { sandbox: sb, effects: [] };

  const effects: Effect[] = [];
  const sandbox = await mutateSandbox(sb.id, (d) => {
    const call = d.call;
    const incident = d.incident;
    const t = Date.now();
    if (call?.status === 'investigating' && call.ringAt && Date.parse(call.ringAt) <= t) {
      call.status = 'ringing';
    }
    if (call?.status === 'ringing' && call.ringAt && t - Date.parse(call.ringAt) > RING_MS) {
      call.status = 'missed';
      if (call.attempt < MAX_RING_ATTEMPTS) {
        call.retryAt = nowIso(t + RETRY_DELAY_MS);
        pushAction(d, { tool: 'page', kind: 'system', title: `No answer from ${d.engineer} (attempt ${call.attempt})`, detail: 'Ringing again in 10 seconds.', phase: 'before' });
        pushChannel(d, 'Vigil', 'vigil', `No answer from ${d.engineer} (attempt ${call.attempt}). Ringing again.`);
      } else {
        call.retryAt = null;
        escalate(d, `${d.engineer} did not answer ${call.attempt} calls`);
      }
    }
    if (call?.status === 'missed' && call.retryAt && Date.parse(call.retryAt) <= t && call.attempt < MAX_RING_ATTEMPTS) {
      call.status = 'ringing';
      call.attempt += 1;
      call.retryAt = null;
      call.ringAt = nowIso(t);
    }
    if (call?.status === 'active' && call.lastSeenAt && t - Date.parse(call.lastSeenAt) > STALE_CALL_MS) {
      endCallDraft(d, 'connection_lost', effects);
    }
    if (call?.status === 'active' && call.startedAt && t - Date.parse(call.startedAt) > ((call.maxSeconds ?? MAX_CALL_SECONDS) + 20) * 1000) {
      endCallDraft(d, 'time_limit', effects);
    }
    if (incident && incident.mitigatedAt && !incident.recoveredAt && isRecovered(incident, t)) {
      incident.recoveredAt = nowIso(t);
      if (incident.status !== 'resolved') incident.status = 'monitoring';
      const def = SCENARIOS[incident.scenario];
      const m = def.metrics[0];
      const value = fmtMetric(m, metricValue(m, incident, t, d.id));
      pushAction(d, {
        tool: 'monitor',
        kind: 'system',
        title: `Recovery confirmed: ${m.label.toLowerCase()} now ${value}`,
        detail: `Baseline ${fmtMetric(m, m.base)}. Watched live metrics after the fix.`,
      });
      pushChannel(d, 'Vigil', 'vigil', `Recovery confirmed: ${m.label.toLowerCase()} now ${value} (baseline ${fmtMetric(m, m.base)}, alert threshold ${fmtMetric(m, m.threshold)}).`);
      if (d.call?.status === 'active' && d.call.agentId && d.call.channel && !incident.recoveryAnnounced) {
        incident.recoveryAnnounced = true;
        const { agentId, channel } = d.call;
        const text = `${SYSTEM_UPDATE_MARK} Live monitoring update (not from the engineer): ${m.label} has recovered to ${value}, near the ${fmtMetric(m, m.base)} baseline and well inside the ${fmtMetric(m, m.threshold)} alert threshold. The fix is confirmed by live metrics. Tell ${d.engineer} in one short sentence, then offer to update the status page and post in the incident channel.`;
        effects.push(async () => agentThink(agentId, channel, text));
      }
    }
    if (call?.status === 'active' && call.teammateJoinedAt && !call.teammateAnnounced && call.agentId && call.channel) {
      call.teammateAnnounced = true;
      const who = call.teammatePaged?.name ?? PEOPLE.owner.name;
      const { agentId, channel } = call;
      const text = `${SYSTEM_UPDATE_MARK} ${who} has just joined this call. Greet ${who.split(' ')[0]} by name and brief them in two short sentences: what broke, what has been done, and the current status. Then tell ${who.split(' ')[0]} in one short sentence that they can ask you questions from their phone, and that ${d.engineer} approves any change. Then continue helping both of them.`;
      effects.push(async () => agentThink(agentId, channel, text));
    }
    return d;
  });
  return { sandbox, effects };
}

function escalate(d: Sandbox, why: string): void {
  if (d.escalatedTo) return;
  d.escalatedTo = PEOPLE.secondary.name;
  pushAction(d, { tool: 'page_secondary', kind: 'comms', title: `Escalated to secondary on-call ${PEOPLE.secondary.name}`, detail: `${why}. Runbook RB-31.`, phase: 'before' });
  pushChannel(d, 'Vigil', 'vigil', `${why}. Paging the secondary on-call, ${PEOPLE.secondary.name}, with the full diagnosis.`);
}

function endCallDraft(d: Sandbox, reason: string, effects: Effect[]): void {
  const call = d.call;
  if (!call || call.status !== 'active') return;
  call.status = 'ended';
  call.endedAt = nowIso();
  call.endReason = reason;
  const agentId = call.agentId;
  if (agentId) effects.push(async () => stopAgent(agentId));
  const label =
    reason === 'time_limit' ? 'Call ended at the demo time limit.' : reason === 'connection_lost' ? 'Call ended: the engineer’s connection was lost.' : 'Call ended.';
  pushAction(d, { tool: 'call', kind: 'system', title: label, phase: 'after' });
}

// ---------------------------------------------------------------------------
// Incidents

export async function triggerIncident(id: string, scenario: ScenarioId): Promise<{ ok: boolean; error?: string; effects: Effect[] }> {
  const def = SCENARIOS[scenario];
  if (!def) return { ok: false, error: 'Unknown incident', effects: [] };
  const effects: Effect[] = [];
  await mutateSandbox(id, (d) => {
    // Breaking production again starts a fresh incident.
    if (d.call?.status === 'active' && d.call.agentId) {
      const agentId = d.call.agentId;
      effects.push(async () => stopAgent(agentId));
    }
    const now = Date.now();
    const alertAt = now - 38_000;
    const faultAt = alertAt - 120_000;
    d.incidentCount += 1;
    d.actions = [];
    d.channel = [];
    d.transcript = [];
    d.escalatedTo = null;
    d.incident = {
      id: `INC-${2480 + d.incidentCount}`,
      scenario,
      severity: def.severity,
      title: def.title,
      faultAt: nowIso(faultAt),
      alertAt: nowIso(alertAt),
      status: 'investigating',
      mitigatedAt: null,
      recoveredAt: null,
      recoveryAnnounced: false,
      resolvedAt: null,
      rootCause: null,
      summary: null,
      remediations: [],
      statusUpdates: [],
      followUps: [],
    };
    const inc = d.incident;
    const past = [...(d.history ?? [])].reverse().find((h) => h.scenario === scenario);
    inc.recommended = past?.recommended ?? def.recommended;
    inc.learnedFrom = past ? { id: past.id, fix: past.fix, blocked: past.blocked } : null;

    // Vigil investigates before it calls: read-only findings, timestamped as they happened.
    const step = (ms: number) => nowIso(alertAt + ms);
    pushChannel(d, 'Alerts', 'bot', `[${def.severity}] ${def.alert}. ${inc.id} opened.`, step(0));
    pushAction(d, { tool: 'alert', kind: 'system', title: `Alert: ${def.alert}`, detail: `${inc.id} opened at ${def.severity}.`, at: step(0), phase: 'before' });

    const impact = impactAt(def, inc, alertAt + 4000);
    pushAction(d, {
      tool: 'get_incident',
      kind: 'read',
      title: `Assessed impact: about ${fmtInt((def.peakFailure * 1240) | 0)} failed orders a minute`,
      detail: `${fmtInt(impact.failedOrders)} orders failed so far, ${fmtINRShort(impact.inr)} at risk.`,
      at: step(4000),
      phase: 'before',
    });

    const changes = recentChanges(inc);
    const top = changes[0];
    pushAction(d, {
      tool: 'list_recent_changes',
      kind: 'read',
      title:
        scenario === 'upi_provider'
          ? 'Checked recent changes: nothing shipped to payments in 9 days'
          : `Found: ${top.summary} (${top.author})`,
      detail: scenario === 'upi_provider' ? 'The only change in the last hour is a web-app copy edit.' : `${fmtClock(top.at)}, a minute before the errors began.`,
      at: step(11_000),
      phase: 'before',
    });

    if (scenario === 'upi_provider') {
      pushAction(d, {
        tool: 'check_dependencies',
        kind: 'read',
        title: 'PayNova (primary UPI) is timing out; Cashly (backup) is healthy',
        detail: 'PayNova average 9.4 s, about 38% failing. Cashly p95 1.1 s, 99.2% success.',
        at: step(17_000),
        phase: 'before',
      });
    } else {
      const sig = logSignatures(scenario).find((l) => !l.untrusted && (l.level === 'ERROR' || l.level === 'FATAL' || l.level === 'LOG'))!;
      pushAction(d, {
        tool: 'search_logs',
        kind: 'read',
        title:
          scenario === 'bad_deploy'
            ? `${fmtInt(sig.perMin * 2)} NullPointerExceptions in CouponEngine.apply`
            : 'Long query pid 48213 from merchant-weekly-report (6 min, full scan)',
        detail: sig.message.slice(0, 140),
        at: step(17_000),
        phase: 'before',
      });
    }
    const rb = searchRunbooks(scenario === 'bad_deploy' ? 'errors after deploy rollback' : scenario === 'upi_provider' ? 'upi payment provider failover' : 'database saturation job')[0];
    pushAction(d, { tool: 'search_runbooks', kind: 'read', title: `Runbook ${rb.id}: ${rb.title}`, detail: rb.steps[1], at: step(24_000), phase: 'before' });
    if (past) {
      pushAction(d, {
        tool: 'memory',
        kind: 'read',
        title: `Matched a past incident: ${past.id}, resolved at ${fmtClock(past.resolvedAt)}`,
        detail: `${past.blocked ? `${upperFirst(past.blocked)}. ` : ''}${upperFirst(past.fix)} fixed it.`,
        at: step(27_000),
        phase: 'before',
      });
    }
    pushAction(d, {
      tool: 'diagnosis',
      kind: 'system',
      title: `Diagnosis ready. Recommended: ${inc.recommended}${past ? ` (it fixed ${past.id})` : ''}.`,
      detail: `Calling ${d.engineer} (primary on-call).`,
      at: step(31_000),
      phase: 'before',
    });
    pushChannel(d, 'Vigil', 'vigil', `Investigating ${inc.id}. Likely cause: ${likelyCause(scenario)}. Recommended: ${inc.recommended}. Calling ${d.engineer} now.`, step(31_000));
    inc.status = 'identified';

    d.call = {
      status: 'investigating',
      kind: 'page',
      attempt: 1,
      ringAt: nowIso(now + INVESTIGATION_MS),
      retryAt: null,
      agentId: null,
      channel: null,
      engineerUid: null,
      startedAt: null,
      lastSeenAt: null,
      endedAt: null,
      endReason: null,
      teammatePaged: null,
      teammateJoinedAt: null,
      teammateAnnounced: false,
    };
  });
  return { ok: true, effects };
}

export function likelyCause(scenario: ScenarioId): string {
  switch (scenario) {
    case 'bad_deploy':
      return 'payments-service 4.2.1 (new coupon engine) is throwing NullPointerExceptions';
    case 'upi_provider':
      return 'PayNova, our primary UPI provider, is timing out';
    case 'db_overload':
      return 'the merchant-weekly-report job is running a full table scan on the primary database';
  }
}

export async function resetSandbox(id: string): Promise<Effect[]> {
  const effects: Effect[] = [];
  await mutateSandbox(id, (d) => {
    if (d.call?.status === 'active' && d.call.agentId) {
      const agentId = d.call.agentId;
      effects.push(async () => stopAgent(agentId));
    }
    d.incident = null;
    d.call = null;
    d.actions = [];
    d.channel = [];
    d.transcript = [];
    d.escalatedTo = null;
    d.history = [];
  });
  return effects;
}

export async function setEngineer(id: string, name: string): Promise<boolean> {
  const clean = cleanName(name);
  if (!clean) return false;
  await mutateSandbox(id, (d) => {
    d.engineer = clean;
  });
  return true;
}

// ---------------------------------------------------------------------------
// Calls

export type CallGate = { ok: true } | { ok: false; status: number; error: string };

/** Can this visitor start a call right now? (incident active, call answerable, credit limits) */
export async function canStartCall(sb: Sandbox, owner: boolean): Promise<CallGate> {
  if (!sb.incident || sb.incident.status === 'resolved') {
    return { ok: false, status: 409, error: 'There is no open incident. Break production first.' };
  }
  if (!owner) {
    if (sb.callsUsed >= MAX_CALLS_PER_SANDBOX) {
      return { ok: false, status: 429, error: `This sandbox has used its ${MAX_CALLS_PER_SANDBOX} demo calls. Reset or open a new sandbox tomorrow.` };
    }
    if ((await readDailyCalls()) >= DAILY_CALL_CAP) {
      return { ok: false, status: 429, error: 'Today’s demo calls are used up. Please try again tomorrow, or watch the demo video.' };
    }
  }
  return { ok: true };
}

/** The engineer picks up (or calls back). The agent is invited right after. */
export async function answerCall(id: string): Promise<void> {
  await mutateSandbox(id, (d) => {
    const t = nowIso();
    const callback = !d.call || d.call.status === 'ended' || d.call.status === 'declined';
    if (!d.call || callback) {
      d.call = {
        status: 'active',
        kind: 'callback',
        attempt: 1,
        ringAt: null,
        retryAt: null,
        agentId: null,
        channel: null,
        engineerUid: null,
        startedAt: t,
        lastSeenAt: t,
        endedAt: null,
        endReason: null,
        teammatePaged: d.call?.teammatePaged ?? null,
        teammateJoinedAt: null,
        teammateAnnounced: false,
      };
    } else {
      d.call.status = 'active';
      d.call.startedAt = t;
      d.call.lastSeenAt = t;
      d.call.retryAt = null;
      d.call.endedAt = null;
      d.call.endReason = null;
    }
    pushAction(d, { tool: 'call', kind: 'system', title: callback ? `${d.engineer} called Vigil back` : `${d.engineer} answered`, phase: 'call' });
  });
}

export async function markAgentStarted(
  id: string,
  info: { agentId: string; channel: string; engineerUid: string; toolsVia: 'rest' | 'mcp' },
  owner = false,
): Promise<void> {
  // The owner's own rehearsals never use up the shared daily cap that protects public visitors.
  if (!owner) await incrementDailyCalls();
  await mutateSandbox(id, (d) => {
    if (!d.call) return;
    d.call.agentId = info.agentId;
    d.call.channel = info.channel;
    d.call.engineerUid = info.engineerUid;
    d.call.toolsVia = info.toolsVia;
    d.call.maxSeconds = owner ? OWNER_MAX_CALL_SECONDS : MAX_CALL_SECONDS;
    d.call.lastSeenAt = nowIso();
    d.callsUsed += 1;
    pushAction(d, {
      tool: 'call',
      kind: 'system',
      title: 'Vigil joined the call',
      detail: `Agora Conversational AI · Murf Falcon 2.1 · 13 tools over ${info.toolsVia === 'mcp' ? 'MCP' : 'HTTPS'}`,
    });
  });
}

export async function declineCall(id: string): Promise<void> {
  await mutateSandbox(id, (d) => {
    if (!d.call || (d.call.status !== 'ringing' && d.call.status !== 'investigating')) return;
    d.call.status = 'declined';
    d.call.retryAt = null;
    escalate(d, `${d.engineer} declined the call`);
  });
}

export async function failCall(id: string, why: string): Promise<void> {
  await mutateSandbox(id, (d) => {
    if (!d.call) return;
    d.call.status = 'ended';
    d.call.endedAt = nowIso();
    d.call.endReason = 'connect_failed';
    pushAction(d, { tool: 'call', kind: 'failed', title: 'Call could not connect', detail: why.slice(0, 160), phase: 'after' });
  });
}

export async function endCall(id: string, agentId?: string | null): Promise<Effect[]> {
  const effects: Effect[] = [];
  await mutateSandbox(id, (d) => {
    if (d.call?.status === 'active' && (!agentId || !d.call.agentId || d.call.agentId === agentId)) {
      endCallDraft(d, 'hung_up', effects);
    }
  });
  return effects;
}

export async function heartbeat(id: string): Promise<void> {
  const sb = await readSandbox(id);
  if (sb?.call?.status !== 'active') return;
  await mutateSandbox(id, (d) => {
    if (d.call?.status === 'active') d.call.lastSeenAt = nowIso();
  });
}

/** Merge live captions from the engineer's call screen into the server transcript. */
export async function mergeCaptions(id: string, lines: { who: string; text: string }[]): Promise<void> {
  const clean = lines
    .filter((l) => typeof l?.text === 'string' && l.text.trim() && !INTERNAL_MARK.test(l.text))
    .slice(-12)
    .map((l) => ({ who: (['agent', 'engineer', 'teammate'].includes(l.who) ? l.who : 'engineer') as CaptionLine['who'], text: l.text.trim().slice(0, 500) }));
  if (clean.length === 0) return;
  await mutateSandbox(id, (d) => {
    if (d.call?.status === 'active') d.call.lastSeenAt = nowIso();
    for (const line of clean) {
      const recent = d.transcript.slice(-30);
      if (recent.some((r) => r.who === line.who && r.text === line.text)) continue;
      // A growing partial transcript replaces its earlier version.
      const prev = [...recent].reverse().find((r) => r.who === line.who && !r.typed);
      if (prev && line.text.startsWith(prev.text) && Date.now() - Date.parse(prev.at) < 20_000) {
        prev.text = line.text;
        continue;
      }
      d.transcript.push({ at: nowIso(), who: line.who, text: line.text });
    }
  });
}

export async function addTyped(id: string, text: string): Promise<void> {
  const clean = text.trim().slice(0, 400);
  if (!clean) return;
  await mutateSandbox(id, (d) => {
    d.transcript.push({ at: nowIso(), who: 'engineer', text: clean, typed: true });
    if (d.call?.status === 'active') d.call.lastSeenAt = nowIso();
  });
}

export async function teammateJoined(id: string): Promise<void> {
  await mutateSandbox(id, (d) => {
    if (!d.call) return;
    d.call.teammateJoinedAt = nowIso();
    const who = d.call.teammatePaged?.name ?? PEOPLE.owner.name;
    pushAction(d, { tool: 'bridge', kind: 'system', title: `${who} joined the live call` });
    pushChannel(d, 'Vigil', 'vigil', `${who} joined the incident call.`);
  });
}

/**
 * A teammate on the live call (for example a manager without a laptop) asks Vigil a question from
 * their phone. Agora's engine listens to one person, the on-call engineer, so the question arrives
 * as text through the think API and Vigil answers out loud for everyone. Teammates can ask anything
 * but never approve a change: their words are stored as "teammate" lines, which the approval guard
 * ignores, and Vigil relays any requested change to the on-call engineer.
 */
export async function teammateAsk(id: string, raw: string): Promise<{ ok: boolean; status: number; error?: string; effects: Effect[] }> {
  // Control characters and Vigil's internal marks (⟦…⟧) become spaces, so nobody can fake a monitor message.
  const text = Array.from(String(raw), (ch) => {
    const code = ch.charCodeAt(0);
    return code < 32 || code === 127 || ch === '⟦' || ch === '⟧' ? ' ' : ch;
  })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
  if (text.length < 2) return { ok: false, status: 400, error: 'Type a question first.', effects: [] };
  const effects: Effect[] = [];
  const refused = { status: 0, error: '' };
  await mutateSandbox(id, (d) => {
    const call = d.call;
    if (!call || call.status !== 'active' || !call.agentId || !call.channel) {
      refused.status = 409;
      refused.error = 'The call is not live right now.';
      return;
    }
    if (!call.teammateJoinedAt) {
      refused.status = 409;
      refused.error = 'Join the call first.';
      return;
    }
    const now = Date.now();
    const asked = d.transcript.filter((l) => l.who === 'teammate');
    const last = asked[asked.length - 1];
    if (last && now - Date.parse(last.at) < TEAMMATE_ASK_GAP_MS) {
      refused.status = 429;
      refused.error = 'One moment: Vigil is still answering.';
      return;
    }
    if (asked.length >= MAX_TEAMMATE_QUESTIONS) {
      refused.status = 429;
      refused.error = 'That is the question limit for this call.';
      return;
    }
    const who = call.teammatePaged?.name ?? PEOPLE.owner.name;
    const first = who.split(' ')[0];
    d.transcript.push({ at: nowIso(now), who: 'teammate', text, typed: true });
    pushAction(d, {
      tool: 'ask',
      kind: 'system',
      title: `${who} asked Vigil: "${text}"`,
      detail: `From ${first}'s phone. Teammates can ask anything; only ${d.engineer} can approve changes.`,
    });
    const { agentId, channel } = call;
    const message = `${TEAMMATE_MARK} ${who} is on this call and typed this question on their phone: "${text}". Answer ${first} out loud by name, in two or three sentences, from the incident facts and your tools. ${first} cannot approve production changes: if this asks for a change, do not run it; tell ${d.engineer} what ${first} suggests and ask ${d.engineer} whether to do it.`;
    effects.push(async () => agentThink(agentId, channel, message));
  });
  if (refused.status) return { ok: false, status: refused.status, error: refused.error, effects: [] };
  return { ok: true, status: 200, effects };
}

function upperFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
