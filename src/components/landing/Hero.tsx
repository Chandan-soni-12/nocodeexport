'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowRight, Globe, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

export default function Hero() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleExport = async () => {
    if (!url.trim()) {
      toast.error('Please enter a URL');
      return;
    }

    // Basic URL validation
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    try {
      new URL(normalizedUrl);
    } catch {
      toast.error('Please enter a valid URL');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/export/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: normalizedUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to start export');
        return;
      }

      router.push(`/export/${data.exportId}`);
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="hero" className="relative min-h-screen flex items-center justify-center pt-16">
      {/* Floating orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/3 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <span className="badge badge-accent">
            <Sparkles className="w-3.5 h-3.5" />
            Free to use — No account required
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-8 text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1]"
        >
          Export any Framer site
          <br />
          <span className="text-gradient">to clean HTML</span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-6 text-lg sm:text-xl text-text-secondary max-w-2xl mx-auto leading-relaxed"
        >
          Paste your published Framer URL. We&apos;ll crawl every page, download all assets,
          preserve animations, and give you a clean ZIP — <span className="text-text-primary font-medium">watermark-free</span>.
        </motion.p>

        {/* URL Input */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-10 max-w-2xl mx-auto"
        >
          <div className="flex flex-col sm:flex-row gap-3 p-2 rounded-2xl bg-bg-secondary border border-border-primary glow-accent">
            <div className="flex-1 flex items-center gap-3 px-4">
              <Globe className="w-5 h-5 text-text-muted shrink-0" />
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleExport()}
                placeholder="https://your-site.framer.website"
                className="flex-1 bg-transparent text-text-primary placeholder-text-muted outline-none text-base py-3"
                disabled={loading}
              />
            </div>
            <button
              onClick={handleExport}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-8 py-3.5 bg-accent hover:bg-accent-hover text-white font-medium rounded-xl transition-all hover:glow-accent disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base whitespace-nowrap"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  Export Free
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          <p className="mt-4 text-xs text-text-muted">
            Works with Framer, Webflow, Wix, and other no-code platforms.
            Free tier includes 10 exports per month.
          </p>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-16 flex flex-wrap items-center justify-center gap-8 sm:gap-12"
        >
          {[
            { value: '12,000+', label: 'Sites Exported' },
            { value: '99.8%', label: 'Success Rate' },
            { value: '<2min', label: 'Avg Export Time' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-text-primary">{stat.value}</div>
              <div className="text-sm text-text-muted mt-1">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
