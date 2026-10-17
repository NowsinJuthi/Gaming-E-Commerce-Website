import { BILLING_CYCLES, BillingCycle } from './media-subscription.types';

export function addBillingCycle(from: Date, cycle: BillingCycle): Date {
  const next = new Date(from);
  if (cycle === 'yearly') {
    next.setFullYear(next.getFullYear() + 1);
  } else {
    next.setMonth(next.getMonth() + 1);
  }
  return next;
}

export function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

export function priceForCycle(
  monthlyPriceCents: number,
  yearlyPriceCents: number,
  cycle: BillingCycle,
): number {
  return cycle === BILLING_CYCLES[1] ? yearlyPriceCents : monthlyPriceCents;
}
