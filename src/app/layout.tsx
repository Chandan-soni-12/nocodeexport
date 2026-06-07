import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata: Metadata = {
  title: 'NoCodeExport — Export Framer Sites to HTML',
  description:
    'Export any Framer website to clean, static HTML. Download all pages, assets, animations — watermark-free. Deploy anywhere.',
  keywords: ['framer', 'export', 'html', 'static site', 'no code', 'website export'],
  openGraph: {
    title: 'NoCodeExport — Export Framer Sites to HTML',
    description: 'Export any Framer website to clean, static HTML. Watermark-free.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        <div className="gradient-bg" />
        <div className="relative z-10 min-h-screen flex flex-col">
          {children}
        </div>
        <Toaster
          position="bottom-right"
          theme="dark"
          toastOptions={{
            style: {
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border-primary)',
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-sans)',
            },
          }}
        />
      </body>
    </html>
  );
}
