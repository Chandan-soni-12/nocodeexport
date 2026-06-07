'use client';

import { useState } from 'react';
import { Download, Globe, ExternalLink, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import type { SSEProgressEvent } from '@/types';

interface DownloadCardProps {
  exportId: string;
  data: SSEProgressEvent;
}

export default function DownloadCard({ exportId, data }: DownloadCardProps) {
  const [deploying, setDeploying] = useState(false);
  const [deployUrl, setDeployUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleDownload = () => {
    window.location.href = `/api/export/download/${exportId}`;
    toast.success('Download started!');
  };

  const handleDeploy = async () => {
    setDeploying(true);
    try {
      const siteName = `export-${exportId.slice(0, 8)}`;
      const response = await fetch('/api/deploy/netlify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exportId, siteName }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || 'Deploy failed');
        return;
      }

      setDeployUrl(result.deployUrl);
      toast.success('Deployed to Netlify!');
    } catch {
      toast.error('Deployment failed. Is Netlify configured?');
    } finally {
      setDeploying(false);
    }
  };

  const handleCopyUrl = async () => {
    if (!deployUrl) return;
    await navigator.clipboard.writeText(deployUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('URL copied!');
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="glass-card p-8 space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center p-4 rounded-xl bg-bg-primary">
          <div className="text-2xl font-bold text-accent">{data.pageCount || 0}</div>
          <div className="text-xs text-text-muted mt-1">Pages</div>
        </div>
        <div className="text-center p-4 rounded-xl bg-bg-primary">
          <div className="text-2xl font-bold text-accent">{data.assetCount || 0}</div>
          <div className="text-xs text-text-muted mt-1">Assets</div>
        </div>
        <div className="text-center p-4 rounded-xl bg-bg-primary">
          <div className="text-2xl font-bold text-accent">{formatSize(data.sizeBytes || 0)}</div>
          <div className="text-xs text-text-muted mt-1">Size</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleDownload}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-accent hover:bg-accent-hover text-white font-medium rounded-xl transition-all hover:glow-accent"
        >
          <Download className="w-4 h-4" />
          Download ZIP
        </button>

        <button
          onClick={handleDeploy}
          disabled={deploying || !!deployUrl}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-bg-tertiary hover:bg-border-secondary text-text-primary font-medium rounded-xl transition-all disabled:opacity-50"
        >
          {deploying ? (
            <>
              <div className="w-4 h-4 border-2 border-text-muted/30 border-t-text-primary rounded-full animate-spin" />
              Deploying...
            </>
          ) : deployUrl ? (
            <>
              <Check className="w-4 h-4 text-success" />
              Deployed
            </>
          ) : (
            <>
              <Globe className="w-4 h-4" />
              Deploy to Netlify
            </>
          )}
        </button>
      </div>

      {/* Deploy URL */}
      {deployUrl && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-bg-primary border border-border-primary">
          <ExternalLink className="w-4 h-4 text-accent shrink-0" />
          <a
            href={deployUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-accent hover:underline truncate flex-1"
          >
            {deployUrl}
          </a>
          <button
            onClick={handleCopyUrl}
            className="p-1.5 rounded-lg hover:bg-bg-tertiary transition-colors"
          >
            {copied ? (
              <Check className="w-4 h-4 text-success" />
            ) : (
              <Copy className="w-4 h-4 text-text-muted" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}
