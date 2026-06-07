'use client';

import { useState, useEffect, useRef } from 'react';
import type { SSEProgressEvent } from '@/types';

interface LogEntry {
  id: number;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'accent';
}

interface ProgressStreamProps {
  exportId: string;
  onComplete: (data: SSEProgressEvent) => void;
  onError: (error: string) => void;
}

export default function ProgressStream({ exportId, onComplete, onError }: ProgressStreamProps) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Connecting...');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const logCounter = useRef(0);

  useEffect(() => {
    const eventSource = new EventSource(`/api/export/status/${exportId}`);
    let lastMessage = '';

    eventSource.onopen = () => {
      setConnected(true);
      addLog('Connected to export stream', 'accent');
    };

    eventSource.onmessage = (event) => {
      try {
        const data: SSEProgressEvent = JSON.parse(event.data);

        setProgress(data.progress);
        setStatus(data.message);

        // Only add log if message changed
        if (data.message && data.message !== lastMessage) {
          lastMessage = data.message;

          const type =
            data.status === 'FAILED' ? 'error' :
            data.status === 'COMPLETED' ? 'success' :
            data.message.includes('Found') || data.message.includes('Captured') ? 'accent' :
            'info';

          addLog(data.message, type);
        }

        if (data.status === 'COMPLETED') {
          addLog(`✓ Export complete! ${data.pageCount} pages, ${data.assetCount} assets`, 'success');
          eventSource.close();
          onComplete(data);
        }

        if (data.status === 'FAILED') {
          addLog(`✗ Export failed: ${data.error || 'Unknown error'}`, 'error');
          eventSource.close();
          onError(data.error || 'Export failed');
        }
      } catch {
        // Invalid JSON — skip
      }
    };

    eventSource.onerror = () => {
      setConnected(false);
      // EventSource auto-reconnects, but after a few failures we should stop
    };

    return () => {
      eventSource.close();
    };
  }, [exportId, onComplete, onError]);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  function addLog(message: string, type: LogEntry['type'] = 'info') {
    const now = new Date();
    const timestamp = now.toLocaleTimeString('en-US', { hour12: false });

    setLogs((prev) => [
      ...prev,
      {
        id: ++logCounter.current,
        timestamp,
        message,
        type,
      },
    ]);
  }

  return (
    <div className="space-y-6">
      {/* Status header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`pulse-dot ${!connected ? 'opacity-30' : ''}`}
            style={{ background: connected ? 'var(--color-success)' : 'var(--color-text-muted)' }}
          />
          <span className="text-sm font-medium text-text-secondary">{status}</span>
        </div>
        <span className="text-sm font-mono text-text-muted">{progress}%</span>
      </div>

      {/* Progress bar */}
      <div className="progress-bar">
        <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* Terminal log */}
      <div ref={logRef} className="terminal-log">
        {logs.length === 0 && (
          <div className="text-text-muted text-center py-4">
            Waiting for export to start...
          </div>
        )}
        {logs.map((log) => (
          <div key={log.id} className="log-entry" style={{ animationDelay: `${log.id * 50}ms` }}>
            <span className="log-timestamp">[{log.timestamp}]</span>
            <span className={`log-message ${
              log.type === 'success' ? 'log-success' :
              log.type === 'error' ? 'log-error' :
              log.type === 'accent' ? 'log-accent' :
              ''
            }`}>
              {log.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
