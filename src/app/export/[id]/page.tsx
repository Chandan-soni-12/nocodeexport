'use client';

import { useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileArchive } from 'lucide-react';
import Navbar from '@/components/shared/Navbar';
import ProgressStream from '@/components/export/ProgressStream';
import DownloadCard from '@/components/export/DownloadCard';
import type { SSEProgressEvent } from '@/types';

export default function ExportProgressPage() {
  const params = useParams();
  const exportId = params.id as string;
  const [completed, setCompleted] = useState(false);
  const [failed, setFailed] = useState(false);
  const [completedData, setCompletedData] = useState<SSEProgressEvent | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleComplete = useCallback((data: SSEProgressEvent) => {
    setCompleted(true);
    setCompletedData(data);
  }, []);

  const handleError = useCallback((error: string) => {
    setFailed(true);
    setErrorMessage(error);
  }, []);

  return (
    <>
      <Navbar />
      <main className="flex-1 pt-24 pb-16 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto">
          {/* Back link */}
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>

          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center">
              <FileArchive className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">
                {completed ? 'Export Complete' : failed ? 'Export Failed' : 'Exporting...'}
              </h1>
              <p className="text-sm text-text-muted font-mono">{exportId}</p>
            </div>
          </div>

          {/* Progress stream */}
          {!completed && !failed && (
            <ProgressStream
              exportId={exportId}
              onComplete={handleComplete}
              onError={handleError}
            />
          )}

          {/* Success: Download card */}
          {completed && completedData && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-success/10 border border-success/20">
                <span className="text-success text-sm font-medium">
                  ✓ Your site has been exported successfully!
                </span>
              </div>
              <DownloadCard exportId={exportId} data={completedData} />
            </div>
          )}

          {/* Error state */}
          {failed && (
            <div className="space-y-6">
              <div className="p-6 rounded-xl bg-error/10 border border-error/20">
                <h3 className="text-error font-medium mb-2">Export Failed</h3>
                <p className="text-sm text-text-secondary">{errorMessage}</p>
              </div>
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-6 py-3 bg-bg-secondary hover:bg-bg-tertiary text-text-primary rounded-xl transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Try Again
              </Link>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
