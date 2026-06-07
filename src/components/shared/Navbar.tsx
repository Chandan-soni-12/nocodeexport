'use client';

import Link from 'next/link';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Menu, X } from 'lucide-react';

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border-primary/50 backdrop-blur-xl bg-bg-primary/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center group-hover:glow-accent transition-shadow">
              <Zap className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="font-semibold text-lg tracking-tight">
              NoCode<span className="text-accent">Export</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#how-it-works" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
              How it Works
            </a>
            <a href="#features" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
              Features
            </a>
            <a href="#pricing" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
              Pricing
            </a>
            <Link href="/dashboard" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
              Dashboard
            </Link>
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/dashboard"
              className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/#hero"
              className="px-4 py-2 text-sm font-medium bg-accent hover:bg-accent-hover text-white rounded-lg transition-all hover:glow-accent"
            >
              Export Free
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-text-secondary hover:text-text-primary"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-border-primary bg-bg-primary/95 backdrop-blur-xl"
          >
            <div className="px-4 py-4 flex flex-col gap-3">
              <a href="#how-it-works" onClick={() => setMobileOpen(false)} className="px-3 py-2 text-sm text-text-secondary hover:text-text-primary rounded-lg hover:bg-bg-secondary transition-colors">
                How it Works
              </a>
              <a href="#features" onClick={() => setMobileOpen(false)} className="px-3 py-2 text-sm text-text-secondary hover:text-text-primary rounded-lg hover:bg-bg-secondary transition-colors">
                Features
              </a>
              <a href="#pricing" onClick={() => setMobileOpen(false)} className="px-3 py-2 text-sm text-text-secondary hover:text-text-primary rounded-lg hover:bg-bg-secondary transition-colors">
                Pricing
              </a>
              <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="px-3 py-2 text-sm text-text-secondary hover:text-text-primary rounded-lg hover:bg-bg-secondary transition-colors">
                Dashboard
              </Link>
              <Link
                href="/#hero"
                onClick={() => setMobileOpen(false)}
                className="px-4 py-2.5 text-sm font-medium bg-accent hover:bg-accent-hover text-white rounded-lg text-center transition-all"
              >
                Export Free
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
