// ============================================================
// stripe.ts — Stripe client singleton
// ============================================================

import Stripe from 'stripe';

let _stripe: Stripe | null = null;

/**
 * Get the Stripe client instance
 */
export function getStripe(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) {
    return null;
  }

  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }

  return _stripe;
}
