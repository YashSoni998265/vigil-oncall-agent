import type { RemediationAction, ScenarioId } from '@/lib/types';

// Production changes the way a careful SRE makes them. Vigil never ships code: it only runs
// reversible, runbook-approved mitigations, each with a change record (what changes, blast radius,
// risk, undo, how it is verified, who approved it). Where traffic can be split, the change goes to a
// canary share first; the engine checks the canary and either rolls it out to everyone or reverts it.

export { CANARY_PERCENT } from '@/lib/sim';
/** How long the canary runs before the engine decides: roll out to 100% or revert. */
export const CANARY_WATCH_MS = 15_000;

export interface ChangePlan {
  summary: string;
  blastRadius: string;
  risk: string;
  undo: string;
  verify: string;
  /** True when the change can go to a canary share of traffic first. */
  staged: boolean;
}

export function changePlan(scenario: ScenarioId, action: RemediationAction, target: string): ChangePlan {
  if (action === 'disable_feature_flag' && target === 'new-coupon-engine') {
    return {
      summary: 'Switch off feature flag new-coupon-engine',
      blastRadius: 'The coupon step of checkout, for everyone; stackable coupons are unavailable while the flag is off',
      risk: 'Low: the old coupon path works with the new database schema',
      undo: 'Switch the flag back on',
      verify: 'Checkout errors under 2% in the canary, then for everyone',
      staged: true,
    };
  }
  if (action === 'failover_provider' && target === 'cashly') {
    return {
      summary: 'Route UPI payments to Cashly',
      blastRadius: 'All UPI payments; card payments are not touched',
      risk: 'Low: Cashly is healthy at 99.2%; for a while we depend on one provider',
      undo: 'Route back to PayNova after its all-clear and 30 healthy minutes',
      verify: 'UPI payment success above 95% in the canary, then for everyone',
      staged: true,
    };
  }
  if (action === 'pause_job' && target === 'merchant-weekly-report') {
    return {
      summary: 'Pause job merchant-weekly-report and cancel its query 48213',
      blastRadius: "Merchants' weekly report is delayed; no customer impact",
      risk: 'Low: a reporting job, rerun later on the analytics replica',
      undo: 'Rerun the job off-peak on the analytics replica',
      verify: 'orders-db CPU under 60% and connections under 80%',
      staged: false,
    };
  }
  if (action === 'cancel_query') {
    return {
      summary: `Cancel query ${target}`,
      blastRadius: 'One running query; its job may retry',
      risk: 'Low',
      undo: 'Nothing to undo; the job can run again',
      verify: 'orders-db CPU and connections falling',
      staged: false,
    };
  }
  const label = action.replace(/_/g, ' ');
  return {
    summary: `${label[0].toUpperCase()}${label.slice(1)} ${target}`,
    blastRadius: `${target} for everyone`,
    risk: scenario === 'bad_deploy' && action === 'rollback_deploy' ? 'High: blocked by the deploy guard (migration 0087)' : 'Checked by the server before it runs',
    undo: 'Reverse the change',
    verify: 'The incident metric back under its alert threshold',
    staged: false,
  };
}

/** Change ids follow the incident: CHG-2481-1, CHG-2481-2, ... */
export function changeId(incidentId: string, count: number): string {
  return `CHG-${incidentId.replace(/^INC-/, '')}-${count + 1}`;
}
