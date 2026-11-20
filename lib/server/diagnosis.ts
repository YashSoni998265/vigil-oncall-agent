import type { ScenarioId } from '@/lib/types';

// How Vigil reaches a diagnosis before it calls anyone, the way a senior SRE would:
// follow the failing requests down the dependency chain to where the failure starts (a symptom in
// checkout is rarely a checkout bug), rule out the other suspects with evidence, and check every
// candidate fix for safety before recommending one. The facts match lib/server/world.ts.

export type FixVerdict = 'safe' | 'unsafe' | 'no effect';

export interface Diagnosis {
  /** Services from the symptom down to where the failure starts. */
  path: string[];
  /** The node on the service map where the failure starts. */
  rootNode: string;
  /** One sentence: where it starts and why. */
  rootCause: string;
  /** Other suspects, each ruled out with evidence. */
  ruledOut: string[];
  /** Every candidate fix, checked before recommending. */
  preflight: { fix: string; verdict: FixVerdict; why: string }[];
  confidence: 'high' | 'medium';
}

export function diagnosis(scenario: ScenarioId): Diagnosis {
  switch (scenario) {
    case 'bad_deploy':
      return {
        path: ['checkout-api', 'payments-service', 'coupon-engine'],
        rootNode: 'coupon-engine',
        rootCause:
          'The new coupon engine in payments-service 4.2.1 throws a NullPointerException for coupons created before migration 0087, so every checkout that applies one fails.',
        ruledOut: [
          'orders-db is healthy',
          'PayNova and Cashly are operational (98% and 99.2% success)',
          'the api-gateway rate-limit change 58 minutes earlier only touches /search',
          'web-app 9.14.0, 2.5 hours earlier, only added a home-page banner',
        ],
        preflight: [
          { fix: 'Roll back payments-service to 4.2.0', verdict: 'unsafe', why: '4.2.1 ran migration 0087_coupon_rules, which 4.2.0 cannot read, so a rollback would break every checkout' },
          { fix: 'Switch off the new-coupon-engine feature flag', verdict: 'safe', why: 'coupons go back to the old path, which works with the new schema, and it can be switched back on in seconds' },
          { fix: 'Restart or scale payments-service', verdict: 'no effect', why: 'it is a code bug, not load or a stuck process' },
        ],
        confidence: 'high',
      };
    case 'upi_provider':
      return {
        path: ['checkout-api', 'payments-service', 'paynova'],
        rootNode: 'paynova',
        rootCause: 'PayNova, our primary UPI provider, is timing out on collect requests; nothing on Thali’s side changed.',
        ruledOut: [
          'nothing was deployed to payments in 9 days; the only recent change is a web-app copy edit',
          'our own services show no errors apart from the PayNova timeouts',
          'card payments are unaffected',
          'Cashly, the backup provider, is operational at 99.2% success, and the NPCI network reports no issues',
        ],
        preflight: [
          { fix: 'Fail UPI traffic over to Cashly', verdict: 'safe', why: 'Cashly can take all UPI traffic, and we route back after PayNova recovers' },
          { fix: 'Roll back payments-service', verdict: 'no effect', why: 'nothing was deployed in 9 days' },
          { fix: 'Restart or scale our services', verdict: 'no effect', why: 'the timeouts come from PayNova, not from our pods' },
        ],
        confidence: 'high',
      };
    case 'db_overload':
      return {
        path: ['checkout-api', 'orders-db', 'merchant-weekly-report job'],
        rootNode: 'orders-db',
        rootCause:
          'The merchant-weekly-report batch job runs a full table scan on the primary orders database during dinner rush, saturating its CPU and every connection.',
        ruledOut: [
          'checkout traffic is normal, so it is not a traffic spike',
          'no deploy touched orders-db',
          'PayNova and Cashly are operational',
          'the only unusual query is pid 48213 from merchant-weekly-report, a 6-minute full scan',
        ],
        preflight: [
          { fix: 'Pause the merchant-weekly-report job', verdict: 'safe', why: 'it stops the scan now; merchants get their weekly report later' },
          { fix: 'Restart the primary orders database', verdict: 'unsafe', why: 'it drops all 200 connections and fails over for about 4 minutes, a full outage that runbook RB-03 forbids' },
          { fix: 'Add a read replica', verdict: 'no effect', why: 'the scan saturates the primary, and replicas only take reads' },
        ],
        confidence: 'high',
      };
  }
}

/** "Rollback unsafe, feature flag safe, restart no effect" for the investigation timeline. */
export function preflightSummary(d: Diagnosis): string {
  return d.preflight.map((p) => `${shortFix(p.fix)} ${p.verdict}`).join(', ');
}

function shortFix(fix: string): string {
  const f = fix.toLowerCase();
  if (f.startsWith('roll back')) return 'rollback';
  if (f.includes('feature flag')) return 'feature flag';
  if (f.startsWith('fail ')) return 'failover to Cashly';
  if (f.startsWith('pause')) return 'pausing the job';
  if (f.startsWith('restart the primary')) return 'database restart';
  if (f.startsWith('restart')) return 'restart or scale';
  if (f.includes('replica')) return 'read replica';
  return f;
}
