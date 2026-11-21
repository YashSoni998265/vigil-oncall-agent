import type { ScenarioId } from '@/lib/types';

// The exact technical record behind each incident: versions, pull request, commit, files, the stack
// line, queries and numbers. Vigil names these when it explains the cause or the fix and answers
// "what exactly changed?" like a senior engineer. Thali is simulated; these values are consistent
// with the rest of the simulation (lib/server/world.ts, lib/server/diagnosis.ts).

export function technicalRecord(scenario: ScenarioId): string[] {
  switch (scenario) {
    case 'bad_deploy':
      return [
        'Release: payments-service 4.2.1 = PR #482 "Coupon engine v2: stackable coupons" by Arjun Mehta, reviewed by Neha Rao, merge commit 7f3c2a1; merged 18 minutes before the errors, at 100% of traffic one minute before.',
        'Changed: 7 files, +412 -96: CouponEngine.java (apply() rewritten), CouponRules.java (new), migrations/0087_coupon_rules.sql (adds a rules column), FeatureFlags.java (new-coupon-engine, default on), tests.',
        'Versions: 4.1.9 six days ago, 4.2.0 two days ago (stable), 4.2.1 now.',
        'Stack: NullPointerException: Cannot invoke "Coupon.rules()" because "coupon" is null, at CouponEngine.apply(CouponEngine.java:142); only coupons created before migration 0087 (empty rules).',
        'CI passed because the new tests only create coupons after the migration.',
      ];
    case 'upi_provider':
      return [
        'Provider: PayNova UPI collect API (POST /v3/collect): p95 9.4 s (baseline 1.2 s), timeouts after 8 s, about 38% failing; its status page says "Investigating elevated latency".',
        'Our side: payments-service 4.2.0, unchanged for 9 days; pods healthy, no restarts. The only recent change is web-app 9.14.1, a copy edit on the cart page, 47 minutes earlier.',
        'Backup: Cashly UPI, p95 1.1 s, 99.2% success. Routing is a weighted config in payments-service (PayNova 100, Cashly 0), moved to Cashly in stages.',
        'NPCI UPI network: no reported issues. Card payments are unaffected.',
      ];
    case 'db_overload':
      return [
        'Database: orders-db, the primary PostgreSQL database. CPU 98%, connections 200 of 200, and 640 FATAL "remaining connection slots are reserved" errors a minute.',
        "Culprit: pid 48213, application merchant-weekly-report, running for 6 minutes: SELECT merchant_id, SUM(total) FROM orders WHERE created_at > now() - interval '7 days' GROUP BY merchant_id. A sequential scan over about 48 million order rows on the primary.",
        'Job: merchant-weekly-report is a weekly cron at 8 PM, which is dinner rush, owned by Kabir Shah (data platform). It should run on the analytics replica, never the primary.',
        'No deploy touched orders-db in the last 3 hours; checkout traffic is normal.',
      ];
  }
}
