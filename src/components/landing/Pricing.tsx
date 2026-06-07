'use client';

import { motion } from 'framer-motion';
import { Check, Zap, Crown, Infinity } from 'lucide-react';

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Perfect for trying things out',
    icon: Zap,
    featured: false,
    features: [
      '10 exports per month',
      'Up to 5 pages per export',
      'All assets included',
      'Watermark removal',
      'Community support',
    ],
    cta: 'Get Started Free',
    plan: null,
  },
  {
    name: 'Pro',
    price: '$19',
    period: '/month',
    description: 'For professionals and agencies',
    icon: Crown,
    featured: true,
    features: [
      'Unlimited exports',
      'Up to 100 pages per export',
      'Animation preservation',
      'One-click Netlify deploy',
      'Form rewriting',
      'Priority support',
      'Custom domain support',
    ],
    cta: 'Start Pro Plan',
    plan: 'PRO' as const,
  },
  {
    name: 'Lifetime',
    price: '$197',
    period: 'one-time',
    description: 'Pay once, export forever',
    icon: Infinity,
    featured: false,
    features: [
      'Everything in Pro',
      'Unlimited forever',
      'Early access to features',
      'Direct support channel',
      'No recurring fees',
    ],
    cta: 'Get Lifetime Access',
    plan: 'LIFETIME' as const,
  },
];

export default function Pricing() {
  const handleCheckout = async (plan: 'PRO' | 'LIFETIME' | null) => {
    if (!plan) {
      // Free plan — scroll to hero
      document.getElementById('hero')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      // Stripe not configured — that's fine in demo mode
    }
  };

  return (
    <section id="pricing" className="py-32 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <span className="badge badge-accent mb-4">Pricing</span>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-text-secondary text-lg max-w-xl mx-auto">
            Start free, upgrade when you need more.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 items-start">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className={`relative rounded-2xl p-8 ${
                plan.featured
                  ? 'bg-bg-secondary border-2 border-accent glow-accent'
                  : 'glass-card'
              }`}
            >
              {plan.featured && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="px-4 py-1 bg-accent text-white text-xs font-semibold rounded-full">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  plan.featured ? 'bg-accent/20' : 'bg-bg-tertiary'
                }`}>
                  <plan.icon className={`w-5 h-5 ${plan.featured ? 'text-accent' : 'text-text-secondary'}`} />
                </div>
                <span className="font-semibold text-lg">{plan.name}</span>
              </div>

              <div className="mb-2">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className="text-text-muted ml-1 text-sm">{plan.period}</span>
              </div>
              <p className="text-text-muted text-sm mb-8">{plan.description}</p>

              <button
                onClick={() => handleCheckout(plan.plan)}
                className={`w-full py-3 px-6 rounded-xl font-medium text-sm transition-all ${
                  plan.featured
                    ? 'bg-accent hover:bg-accent-hover text-white hover:glow-accent'
                    : 'bg-bg-tertiary hover:bg-border-secondary text-text-primary'
                }`}
              >
                {plan.cta}
              </button>

              <div className="mt-8 space-y-3">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-3">
                    <Check className={`w-4 h-4 mt-0.5 shrink-0 ${
                      plan.featured ? 'text-accent' : 'text-text-muted'
                    }`} />
                    <span className="text-sm text-text-secondary">{feature}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
