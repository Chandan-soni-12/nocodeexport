// ============================================================
// POST /api/checkout — Create Stripe checkout session
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const CheckoutSchema = z.object({
  plan: z.enum(['PRO', 'LIFETIME']),
});

export async function POST(request: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Stripe not configured' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const validated = CheckoutSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Invalid plan selection' },
        { status: 400 }
      );
    }

    const { plan } = validated.data;

    const priceId =
      plan === 'PRO'
        ? process.env.STRIPE_PRO_PRICE_ID
        : process.env.STRIPE_LIFETIME_PRICE_ID;

    if (!priceId) {
      return NextResponse.json(
        { error: `Price ID not configured for ${plan} plan` },
        { status: 503 }
      );
    }

    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: plan === 'LIFETIME' ? 'payment' : 'subscription',
      success_url: `${appUrl}/dashboard?checkout=success`,
      cancel_url: `${appUrl}/?checkout=cancelled`,
      metadata: {
        plan,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[API] Checkout error:', err);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
