import type { ScenarioId } from '@/lib/types';

// "What's at stake", shown when you pick an incident and before you break anything: the services
// involved, what each does and who owns it, the money flowing through them, and what customers
// would feel. Thali is simulated; the numbers match lib/sim.ts (1,240 orders a minute at ₹420).

export interface StakeService {
  name: string;
  role: string;
  owner: string;
}

export interface Stakes {
  services: StakeService[];
  atStake: string;
  ifItBreaks: string;
}

export const STAKES: Record<ScenarioId, Stakes> = {
  bad_deploy: {
    services: [
      { name: 'checkout-api', role: 'Every order goes through it: about 1,240 orders a minute at dinner rush', owner: 'Checkout team' },
      { name: 'payments-service 4.2.1', role: 'Takes every payment, cards and UPI; just deployed (PR #482)', owner: 'Arjun Mehta' },
      { name: 'coupon-engine', role: 'Applies discounts inside payments; new in 4.2.1, behind the new-coupon-engine flag', owner: 'Arjun Mehta' },
    ],
    atStake: 'About ₹5.2 lakh of orders a minute flow through checkout (1,240 orders × ₹420).',
    ifItBreaks: 'Customers who use a coupon can’t pay, and those orders are lost.',
  },
  upi_provider: {
    services: [
      { name: 'payments-service 4.2.0', role: 'Sends every payment to a provider; unchanged for 9 days', owner: 'Arjun Mehta' },
      { name: 'PayNova UPI', role: 'The primary UPI provider; most customers pay by UPI', owner: 'External provider' },
      { name: 'Cashly UPI', role: 'The backup UPI provider, on standby', owner: 'External provider' },
    ],
    atStake: 'About ₹5.2 lakh of orders a minute, and UPI is how most customers pay.',
    ifItBreaks: 'UPI payments hang and fail; customers retry or give up on their orders.',
  },
  db_overload: {
    services: [
      { name: 'orders-db', role: 'The primary database: every order is written here, with 200 connections at most', owner: 'Neha Rao (platform)' },
      { name: 'checkout-api', role: 'Saves each order to orders-db; fails when the database is full', owner: 'Checkout team' },
      { name: 'merchant-weekly-report', role: 'A weekly report for restaurants: useful, but it can wait', owner: 'Kabir Shah (data platform)' },
    ],
    atStake: 'Every new order: about 1,240 a minute, worth ₹5.2 lakh.',
    ifItBreaks: 'Orders can’t be saved, and the app shows errors at checkout.',
  },
};
