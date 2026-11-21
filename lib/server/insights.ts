import 'server-only';
import type { ScenarioId } from '@/lib/types';

// What Vigil checks before recommending a fix, beyond the cause itself: is it one region or everyone
// (a regional network or data-centre problem looks different from a bad release), what customers actually
// experience (a fix is not always instant, and support and the status page need the facts), and a
// five-whys root cause analysis. Thali is simulated; the numbers match lib/sim.ts.

export interface Insights {
  regions: { region: string; value: string }[];
  scope: string;
  customer: { who: string; sees: string; scale: string; support: string; unaffected: string };
  fiveWhys: string[];
}

export function insights(scenario: ScenarioId): Insights {
  switch (scenario) {
    case 'bad_deploy':
      return {
        regions: [
          { region: 'Mumbai', value: '18.3%' },
          { region: 'Delhi', value: '18.1%' },
          { region: 'Bengaluru', value: '18.2%' },
          { region: 'Hyderabad', value: '18.0%' },
        ],
        scope: 'Every region, app and web alike: not a regional network, CDN or data-centre problem. It follows the release, which went to all regions at once.',
        customer: {
          who: 'Customers who apply a coupon at checkout, about 18 percent of orders',
          sees: '"Payment failed, please try again" after tapping Pay, and retrying fails too',
          scale: 'about 220 failed orders a minute, about 92,000 rupees a minute',
          support: '34 support tickets in 10 minutes, mostly "coupon not working"',
          unaffected: 'Orders without a coupon go through; checkout is slower for everyone (p95 940 ms against 230 ms)',
        },
        fiveWhys: [
          'Why are checkouts failing? payments-service returns errors for orders with a coupon.',
          'Why? CouponEngine.apply throws a NullPointerException (CouponEngine.java:142).',
          'Why? Coupons created before migration 0087 have no rules, and the new code assumes they do.',
          'Why did it ship? CI passed: the new tests only create coupons after the migration.',
          'Why so wide? Release 4.2.1 went to 100 percent of traffic at once, with no canary.',
        ],
      };
    case 'upi_provider':
      return {
        regions: [
          { region: 'Mumbai', value: '61%' },
          { region: 'Delhi', value: '60%' },
          { region: 'Bengaluru', value: '62%' },
          { region: 'Hyderabad', value: '61%' },
        ],
        scope: 'Every region and every bank app, but only UPI through PayNova: cards and Cashly are fine. So it is the provider, not our network or one region.',
        customer: {
          who: 'Customers paying by UPI, which is most customers',
          sees: 'UPI payment keeps spinning, then shows pending or failed; some retry or switch to a card',
          scale: 'about 38 percent of UPI payments fail or time out',
          support: '52 support tickets in 10 minutes, many "money debited, order not placed"',
          unaffected: 'Card payments work normally',
        },
        fiveWhys: [
          'Why are UPI payments failing? PayNova’s collect API times out after 8 seconds.',
          'Why? PayNova has elevated latency (p95 9.4 s); its status page says it is investigating.',
          'Why does it hit us this hard? All UPI traffic is routed to PayNova (weights 100 and 0).',
          'Why is it not automatic? Failover to Cashly is a manual, staged step today.',
          'Lasting fix: automatic, health-checked routing between UPI providers.',
        ],
      };
    case 'db_overload':
      return {
        regions: [
          { region: 'Mumbai', value: '9.7%' },
          { region: 'Delhi', value: '9.5%' },
          { region: 'Bengaluru', value: '9.6%' },
          { region: 'Hyderabad', value: '9.4%' },
        ],
        scope: 'Every region, because every region writes orders to the same primary database. Not a regional problem.',
        customer: {
          who: 'Everyone placing an order during the dinner rush',
          sees: 'Checkout spins and some orders fail with "Something went wrong"; the app feels slow',
          scale: 'about 9.6 percent of orders fail, and the API is slower',
          support: '41 support tickets in 10 minutes',
          unaffected: 'Browsing menus works; placing and tracking orders is slow or fails',
        },
        fiveWhys: [
          'Why do orders fail? orders-db refuses new connections: 200 of 200 are in use.',
          'Why? CPU is at 98 percent, so queries are slow and connections pile up.',
          'Why? A weekly report (pid 48213) is scanning 48 million order rows on the primary.',
          'Why on the primary at dinner rush? The cron runs at 8 PM and points at the primary, not the analytics replica.',
          'Lasting fix: run reports on the replica, outside peak hours, with a statement timeout.',
        ],
      };
  }
}

/** The region check, for the investigation timeline. */
export function regionSummary(i: Insights): string {
  return i.regions.map((r) => `${r.region} ${r.value}`).join(', ');
}

/** One compact block for Vigil's instructions. */
export function insightFacts(scenario: ScenarioId): string {
  const i = insights(scenario);
  return `Scope (checked before calling): ${regionSummary(i)}. ${i.scope}
Customer experience: ${i.customer.who}. They see ${i.customer.sees}. ${i.customer.scale}; ${i.customer.support}. ${i.customer.unaffected}.
Root cause analysis (five whys): ${i.fiveWhys.join(' ')}`;
}
