// ============================================================
// exportWorker.ts — Background worker for processing exports
// Can run standalone (BullMQ) or inline (in-memory queue)
// ============================================================

import * as path from 'path';
import * as fs from 'fs/promises';
import { db } from '@/lib/db';
import { FramerCrawler } from '@/lib/crawler/FramerCrawler';
import { createZip } from '@/lib/zipper';
import type { ExportJobData, ProgressUpdate } from '@/types';

/** Base directory for export outputs */
const EXPORTS_DIR = path.join(process.cwd(), 'exports');

/**
 * Process a single export job
 * Called by both BullMQ worker and in-memory queue
 */
export async function processExportJob(data: ExportJobData): Promise<void> {
  const { exportId, url } = data;

  try {
    // Update status to PROCESSING
    await db.export.update({
      where: { id: exportId },
      data: { status: 'PROCESSING', progress: 0, progressMessage: 'Starting export...' },
    });

    // Create output directory
    const outputDir = path.join(EXPORTS_DIR, exportId, 'site');
    await fs.mkdir(outputDir, { recursive: true });

    // Create crawler with progress callback
    const crawler = new FramerCrawler(
      url,
      outputDir,
      async (update: ProgressUpdate) => {
        try {
          await db.export.update({
            where: { id: exportId },
            data: {
              progress: update.progress,
              progressMessage: update.message,
              ...(update.stage === 'error' ? { status: 'FAILED', errorMessage: update.message } : {}),
            },
          });
        } catch {
          // DB update failed — non-critical
        }
      }
    );

    // Run the export
    const result = await crawler.export();

    // Create ZIP
    const zipPath = path.join(EXPORTS_DIR, exportId, `${exportId}.zip`);
    const zipResult = await createZip(outputDir, zipPath);

    // Update DB with final result
    await db.export.update({
      where: { id: exportId },
      data: {
        status: 'COMPLETED',
        progress: 100,
        progressMessage: 'Export complete!',
        zipPath: zipResult.zipPath,
        pageCount: result.pageCount,
        assetCount: result.assetCount,
        sizeBytes: zipResult.sizeBytes,
        completedAt: new Date(),
      },
    });

    // Clean up the unzipped site directory to save space
    try {
      await fs.rm(outputDir, { recursive: true, force: true });
    } catch {
      // Cleanup failed — not critical
    }
  } catch (err) {
    const errorMessage = (err as Error).message || 'Unknown error';

    // Update DB with failure
    try {
      await db.export.update({
        where: { id: exportId },
        data: {
          status: 'FAILED',
          progress: 0,
          progressMessage: 'Export failed',
          errorMessage,
        },
      });
    } catch {
      console.error(`[Worker] Failed to update export ${exportId} status:`, errorMessage);
    }

    throw err;
  }
}

// ── BullMQ Worker Mode ─────────────────────────────────────
// When run as a standalone process (pnpm worker), this sets up the BullMQ worker
if (
  typeof process !== 'undefined' &&
  process.argv[1]?.includes('exportWorker')
) {
  startBullMQWorker().catch((err) => {
    console.error('[Worker] Fatal error:', err);
    process.exit(1);
  });
}

async function startBullMQWorker(): Promise<void> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.error('[Worker] REDIS_URL not set. Cannot start BullMQ worker.');
    process.exit(1);
  }

  const { Worker } = await import('bullmq');
  const IORedis = (await import('ioredis')).default;

  const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
  });

  const worker = new Worker(
    'exports',
    async (job) => {
      console.log(`[Worker] Processing job ${job.id}: ${job.data.url}`);
      await processExportJob(job.data as ExportJobData);
      console.log(`[Worker] Completed job ${job.id}`);
    },
    {
      connection: connection as any,
      concurrency: 2,
      limiter: {
        max: 2,
        duration: 1000,
      },
    }
  );

  worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('[Worker] Worker error:', err);
  });

  console.log('[Worker] Export worker started. Waiting for jobs...');

  // Graceful shutdown
  const shutdown = async () => {
    console.log('[Worker] Shutting down...');
    await worker.close();
    await connection.quit();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
