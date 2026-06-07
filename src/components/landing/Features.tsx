'use client';

import { motion } from 'framer-motion';
import {
  Layers,
  ShieldOff,
  Wand2,
  Globe2,
  Code2,
  FormInput,
} from 'lucide-react';

const features = [
  {
    icon: Layers,
    title: 'Pixel Perfect',
    description: 'Every page is captured exactly as it appears — fonts, layouts, responsive breakpoints, all preserved.',
  },
  {
    icon: ShieldOff,
    title: 'Watermark-Free',
    description: 'All "Made in Framer" badges, tracking scripts, and platform branding are automatically removed.',
  },
  {
    icon: Wand2,
    title: 'Animations Preserved',
    description: 'Framer Motion animations, scroll effects, and interactions work perfectly in the exported site.',
  },
  {
    icon: Globe2,
    title: 'Host Anywhere',
    description: 'Deploy to Netlify, Vercel, GitHub Pages, or any static hosting. One-click Netlify deploy included.',
  },
  {
    icon: Code2,
    title: 'Clean Code',
    description: 'Analytics scripts, tracking pixels, and unnecessary code stripped. Clean, lean output files.',
  },
  {
    icon: FormInput,
    title: 'Forms Work',
    description: 'Contact forms are automatically rewired with Formspree placeholders — just add your ID.',
  },
];

export default function Features() {
  return (
    <section id="features" className="py-32 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <span className="badge badge-accent mb-4">Features</span>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Everything you need
          </h2>
          <p className="mt-4 text-text-secondary text-lg max-w-xl mx-auto">
            A complete export that just works — no manual fixes needed.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="glass-card p-7 group cursor-default"
            >
              <div className="w-11 h-11 rounded-xl bg-bg-tertiary flex items-center justify-center mb-5 group-hover:bg-accent/10 transition-colors">
                <feature.icon className="w-5 h-5 text-text-secondary group-hover:text-accent transition-colors" />
              </div>

              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-text-secondary text-sm leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
