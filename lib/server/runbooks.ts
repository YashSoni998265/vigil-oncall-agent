import 'server-only';

// Thali's incident runbooks. search_runbooks retrieves from this corpus, so Vigil's
// recommendations come from the team's own playbooks, not from model memory.

export interface Runbook {
  id: string;
  title: string;
  tags: string[];
  steps: string[];
}

export const RUNBOOKS: Runbook[] = [
  {
    id: 'RB-12',
    title: 'Errors spike right after a deploy',
    tags: ['deploy', 'release', 'rollback', 'errors', '5xx', 'exception', 'nullpointer', 'payments', 'checkout'],
    steps: [
      'Confirm the errors started within 15 minutes of a deploy to the failing service.',
      'Roll back the deploy first: it is the fastest safe fix.',
      'If the rollback is blocked (for example by an irreversible migration), switch off the feature flag that guards the new code path.',
      'Verify for 5 minutes that error rate and latency are back to baseline.',
      'Post on the status page and in the incident channel; page the service owner for the code fix.',
    ],
  },
  {
    id: 'RB-15',
    title: 'Emergency switch-off of a feature flag',
    tags: ['feature', 'flag', 'kill switch', 'coupon', 'disable', 'toggle'],
    steps: [
      'Feature flags can be switched off for 100% of traffic in one step from the flag service.',
      'Switching off a flag is safe with the new database schema when the old code path is kept (true for new-coupon-engine).',
      'Tell the flag owner and open a ticket to fix the new code path.',
    ],
  },
  {
    id: 'RB-07',
    title: 'Payment provider degraded (UPI)',
    tags: ['upi', 'payment', 'provider', 'psp', 'paynova', 'cashly', 'timeout', 'failover', 'success rate'],
    steps: [
      'Check provider health; if our own changes are not the cause, do not roll back.',
      'Fail UPI traffic over to the backup provider (Cashly) through payment routing. It can take 100% of traffic.',
      'Post a status-page notice that UPI payments may be slow, and alert the support team.',
      'Fail back only after the primary provider posts an all-clear and 30 minutes of healthy probes.',
    ],
  },
  {
    id: 'RB-03',
    title: 'Database saturation (CPU or connections)',
    tags: ['database', 'db', 'orders-db', 'postgres', 'cpu', 'connections', 'pool', 'slow query', 'job', 'batch', 'report'],
    steps: [
      'Find the top queries and their source (pg_stat_activity, application_name).',
      'Pause the offending batch job and cancel its running query.',
      'Never restart the primary during an incident: it drops every connection and fails over for about 4 minutes.',
      'If read load persists, add a read replica for read traffic.',
      'Verify CPU below 60% and the connection pool below 80%.',
    ],
  },
  {
    id: 'RB-21',
    title: 'High latency at the API gateway',
    tags: ['latency', 'gateway', 'p95', 'slow', 'timeout'],
    steps: [
      'Find which upstream service is slow from gateway traces.',
      'Do not raise timeouts during an incident; fix or shed the slow dependency.',
      'Scale the slow service only if CPU or memory is saturated.',
    ],
  },
  {
    id: 'RB-30',
    title: 'Communicating during an incident',
    tags: ['status page', 'status', 'customers', 'communication', 'update', 'channel', 'support'],
    steps: [
      'Post on the public status page within 10 minutes of a SEV-1: investigating, identified, monitoring, resolved.',
      'Post in the incident channel at every change of status.',
      'Tell the support lead (Sana Iyer) what customers are seeing and what to say.',
    ],
  },
  {
    id: 'RB-31',
    title: 'Paging and escalation',
    tags: ['page', 'escalate', 'secondary', 'owner', 'on-call', 'add', 'join'],
    steps: [
      'Page the primary on-call first. If there is no answer in 30 seconds, ring once more, then page the secondary (Neha Rao).',
      'Pull in the owner of the failing service when a code fix is needed.',
    ],
  },
  {
    id: 'RB-40',
    title: 'Closing an incident and the postmortem',
    tags: ['resolve', 'close', 'postmortem', 'follow-up', 'action items', 'review'],
    steps: [
      'Resolve only after metrics have been at baseline for at least 5 minutes (shortened to under a minute in this demo).',
      'Write a blameless postmortem: impact, timeline, root cause, what went well, action items with owners.',
      'Schedule the review for the next working morning.',
    ],
  },
];

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

/** Simple lexical retrieval: title matches count triple, tags double, steps once. */
export function searchRunbooks(query: string, limit = 2): Runbook[] {
  const q = tokens(query);
  if (q.length === 0) return RUNBOOKS.slice(0, limit);
  const scored = RUNBOOKS.map((rb) => {
    const title = tokens(rb.title);
    const tags = rb.tags.flatMap(tokens);
    const body = rb.steps.flatMap(tokens);
    let score = 0;
    for (const term of q) {
      if (title.some((t) => t.startsWith(term) || term.startsWith(t))) score += 3;
      if (tags.some((t) => t === term || t.startsWith(term))) score += 2;
      if (body.includes(term)) score += 1;
    }
    return { rb, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.rb);
}
