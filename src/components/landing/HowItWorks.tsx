'use client';

import { motion } from 'framer-motion';
import { Link2, Cpu, Download } from 'lucide-react';

const steps = [
  {
    icon: Link2,
    number: '01',
    title: 'Paste Your URL',
    description: 'Enter your published Framer website URL. We support framer.website, custom domains, and more.',
  },
  {
    icon: Cpu,
    number: '02',
    title: 'We Process It',
    description: 'Our engine crawls every page, captures all assets, preserves animations, and strips watermarks.',
  },
  {
    icon: Download,
    number: '03',
    title: 'Download & Deploy',
    description: 'Get a clean ZIP with all HTML, CSS, JS, images, and fonts. Deploy to Netlify with one click.',
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-32 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <span className="badge badge-accent mb-4">Simple Process</span>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Three steps to freedom
          </h2>
          <p className="mt-4 text-text-secondary text-lg max-w-xl mx-auto">
            No setup, no configuration, no technical knowledge needed.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.15 }}
              className="glass-card p-8 relative group"
            >
              {/* Connector line (between cards) */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-px bg-border-primary" />
              )}

              <div className="text-xs font-mono text-text-muted mb-6">{step.number}</div>
              
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-5 group-hover:bg-accent/20 transition-colors">
                <step.icon className="w-6 h-6 text-accent" />
              </div>

              <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
              <p className="text-text-secondary text-sm leading-relaxed">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
