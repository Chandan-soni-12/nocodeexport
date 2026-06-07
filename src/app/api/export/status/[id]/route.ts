// ============================================================
// GET /api/export/status/[id] — SSE progress stream
// Server-Sent Events for real-time export progress
// ============================================================

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let intervalId: ReturnType<typeof setInterval>;
      let closed = false;

      const sendEvent = (data: Record<string, unknown>) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // Stream might be closed
          cleanup();
        }
      };

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(intervalId);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      };

      // Poll database every second
      intervalId = setInterval(async () => {
        try {
          const exportRecord = await db.export.findUnique({
            where: { id },
          });

          if (!exportRecord) {
            sendEvent({ error: 'Export not found', status: 'FAILED' });
            cleanup();
            return;
          }

          sendEvent({
            status: exportRecord.status,
            progress: exportRecord.progress,
            message: exportRecord.progressMessage,
            pageCount: exportRecord.pageCount,
            assetCount: exportRecord.assetCount,
            sizeBytes: exportRecord.sizeBytes,
            zipReady: exportRecord.status === 'COMPLETED' && !!exportRecord.zipPath,
            error: exportRecord.errorMessage,
          });

          // Close stream when export is done
          if (
            exportRecord.status === 'COMPLETED' ||
            exportRecord.status === 'FAILED'
          ) {
            // Send one more update then close
            setTimeout(cleanup, 1000);
          }
        } catch (err) {
          console.error('[SSE] Error polling export status:', err);
        }
      }, 1000);

      // Handle client disconnect
      request.signal.addEventListener('abort', cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
