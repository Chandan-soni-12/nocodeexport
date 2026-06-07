import Link from 'next/link';
import { ArrowLeft, Download, Clock, CheckCircle2, XCircle, Loader2, Plus, ExternalLink } from 'lucide-react';
import Navbar from '@/components/shared/Navbar';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const statusConfig = {
  PENDING: { icon: Clock, label: 'Pending', class: 'badge-warning' },
  PROCESSING: { icon: Loader2, label: 'Processing', class: 'badge-accent' },
  COMPLETED: { icon: CheckCircle2, label: 'Completed', class: 'badge-success' },
  FAILED: { icon: XCircle, label: 'Failed', class: 'badge-error' },
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function DashboardPage() {
  // Fetch all exports (most recent first)
  const exports = await db.export.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      deployments: true,
    },
  });

  return (
    <>
      <Navbar />
      <main className="flex-1 pt-24 pb-16 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold">Dashboard</h1>
              <p className="text-text-muted mt-1">Your export history</p>
            </div>
            <Link
              href="/"
              className="flex items-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-xl transition-all hover:glow-accent"
            >
              <Plus className="w-4 h-4" />
              New Export
            </Link>
          </div>

          {/* Empty state */}
          {exports.length === 0 && (
            <div className="glass-card p-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-bg-tertiary flex items-center justify-center mx-auto mb-6">
                <Download className="w-8 h-8 text-text-muted" />
              </div>
              <h2 className="text-xl font-semibold mb-2">No exports yet</h2>
              <p className="text-text-muted mb-6">
                Export your first Framer site to see it here.
              </p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-6 py-3 bg-accent hover:bg-accent-hover text-white font-medium rounded-xl transition-all"
              >
                <Plus className="w-4 h-4" />
                Start Exporting
              </Link>
            </div>
          )}

          {/* Export list */}
          {exports.length > 0 && (
            <div className="space-y-3">
              {exports.map((exp) => {
                const config = statusConfig[exp.status as keyof typeof statusConfig] || statusConfig.PENDING;
                const StatusIcon = config.icon;
                const isProcessing = exp.status === 'PROCESSING';

                return (
                  <div
                    key={exp.id}
                    className="glass-card p-5 flex flex-col sm:flex-row sm:items-center gap-4"
                  >
                    {/* URL & status */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className={`badge ${config.class}`}>
                          <StatusIcon className={`w-3 h-3 ${isProcessing ? 'animate-spin' : ''}`} />
                          {config.label}
                        </span>
                        {exp.progress > 0 && exp.progress < 100 && (
                          <span className="text-xs text-text-muted font-mono">{exp.progress}%</span>
                        )}
                      </div>
                      <p className="text-sm text-text-primary truncate font-medium">
                        {exp.sourceUrl}
                      </p>
                      <div className="flex items-center gap-4 mt-1.5 text-xs text-text-muted">
                        <span>{formatDate(exp.createdAt)}</span>
                        {exp.pageCount > 0 && <span>{exp.pageCount} pages</span>}
                        {exp.sizeBytes > 0 && <span>{formatSize(exp.sizeBytes)}</span>}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {exp.status === 'PROCESSING' && (
                        <Link
                          href={`/export/${exp.id}`}
                          className="px-4 py-2 text-xs font-medium text-accent bg-accent/10 hover:bg-accent/20 rounded-lg transition-colors"
                        >
                          View Progress
                        </Link>
                      )}
                      {exp.status === 'COMPLETED' && exp.zipPath && (
                        <a
                          href={`/api/export/download/${exp.id}`}
                          className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-bg-tertiary hover:bg-border-secondary rounded-lg transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download
                        </a>
                      )}
                      {exp.deployments?.length > 0 && exp.deployments[0].deployUrl && (
                        <a
                          href={exp.deployments[0].deployUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-accent bg-accent/10 hover:bg-accent/20 rounded-lg transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Live
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
