// ============================================================
// queue.ts — Export job queue (BullMQ with in-memory fallback)
// Uses Redis when available, falls back to in-memory for dev
// ============================================================

import type { ExportJobData } from '@/types';

/** Queue interface for export jobs */
export interface ExportQueue {
  addJob(data: ExportJobData): Promise<string>;
}

/**
 * In-memory queue for development (no Redis required)
 * Jobs are processed immediately in the background
 */
class InMemoryQueue implements ExportQueue {
  private processor: ((data: ExportJobData) => Promise<void>) | null = null;
  private jobCounter = 0;

  setProcessor(fn: (data: ExportJobData) => Promise<void>): void {
    this.processor = fn;
  }

  async addJob(data: ExportJobData): Promise<string> {
    const jobId = `mem-${++this.jobCounter}-${Date.now()}`;
    console.log(`[InMemoryQueue] addJob called. Job ID: ${jobId}. Processor registered: ${!!this.processor}`);

    // Process in background (don't await)
    if (this.processor) {
      console.log(`[InMemoryQueue] Invoking processor for Job ID: ${jobId}`);
      this.processor(data).catch((err) => {
        console.error(`[InMemoryQueue] Job ${jobId} failed:`, err);
      });
    } else {
      console.warn(`[InMemoryQueue] WARNING: No processor registered when adding Job ID: ${jobId}`);
    }

    return jobId;
  }
}

/**
 * BullMQ-based queue for production (requires Redis)
 */
class BullMQQueue implements ExportQueue {
  private queue: import('bullmq').Queue | null = null;
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      const { Queue } = await import('bullmq');
      const IORedis = (await import('ioredis')).default;

      const connection = new IORedis(process.env.REDIS_URL!, {
        maxRetriesPerRequest: null,
      });

      this.queue = new Queue('exports', { connection: connection as any });
      this.initialized = true;
    } catch (err) {
      console.error('[BullMQQueue] Failed to initialize:', err);
      throw err;
    }
  }

  async addJob(data: ExportJobData): Promise<string> {
    if (!this.queue) await this.init();

    const job = await this.queue!.add('export', data, {
      attempts: 1,
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    });

    return job.id || `bull-${Date.now()}`;
  }
}

// ── Singleton instances ────────────────────────────────────
let _queue: ExportQueue | null = null;
let _inMemoryQueue: InMemoryQueue | null = null;

/**
 * Get the export queue instance
 * Uses BullMQ if REDIS_URL is set, otherwise in-memory
 */
export function getExportQueue(): ExportQueue {
  if (_queue) return _queue;

  if (process.env.REDIS_URL) {
    _queue = new BullMQQueue();
  } else {
    const memQueue = new InMemoryQueue();
    _inMemoryQueue = memQueue;
    _queue = memQueue;
    
    // Auto-register the in-memory processor
    initInMemoryProcessor();
  }

  return _queue;
}

/**
 * Get the in-memory queue (for setting up the processor)
 */
export function getInMemoryQueue(): InMemoryQueue | null {
  return _inMemoryQueue;
}

import { processExportJob } from '@/workers/exportWorker';

/**
 * Initialize the in-memory processor that handles jobs directly
 */
function initInMemoryProcessor(): void {
  if (!_inMemoryQueue) {
    console.warn('[Queue] initInMemoryProcessor called, but _inMemoryQueue is null');
    return;
  }

  console.log('[Queue] Registering in-memory processor...');
  _inMemoryQueue.setProcessor(async (data: ExportJobData) => {
    console.log(`[Queue] In-memory processor triggered for export: ${data.exportId}`);
    await processExportJob(data);
  });
  console.log('[Queue] In-memory processor registered successfully.');
}
