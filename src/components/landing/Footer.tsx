import { Zap } from 'lucide-react';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-border-primary py-12 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold">
              NoCode<span className="text-accent">Export</span>
            </span>
          </Link>

          {/* Links */}
          <div className="flex items-center gap-6 text-sm text-text-muted">
            <a href="#features" className="hover:text-text-primary transition-colors">Features</a>
            <a href="#pricing" className="hover:text-text-primary transition-colors">Pricing</a>
            <Link href="/dashboard" className="hover:text-text-primary transition-colors">Dashboard</Link>
          </div>

          {/* Copyright */}
          <p className="text-sm text-text-muted">
            © {new Date().getFullYear()} NoCodeExport. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
