// ============================================================
// POST /api/export/start — Initiate a new export
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getExportQueue } from '@/lib/queue';

const StartExportSchema = z.object({
  url: z
    .string()
    .url('Please enter a valid URL')
    .refine(
      (url) => url.startsWith('http://') || url.startsWith('https://'),
      'URL must start with http:// or https://'
    ),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = StartExportSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.issues[0].message },
        { status: 400 }
      );
    }

    const { url } = validated.data;

    // Create export record
    const exportRecord = await db.export.create({
      data: {
        sourceUrl: url,
        status: 'PENDING',
        progress: 0,
        progressMessage: 'Queued for processing...',
      },
    });

    // Add to export queue
    const queue = getExportQueue();
    await queue.addJob({
      exportId: exportRecord.id,
      url,
      userId: 'anonymous', // Will be replaced with Clerk auth
    });

    return NextResponse.json({
      exportId: exportRecord.id,
      statusUrl: `/api/export/status/${exportRecord.id}`,
    });
  } catch (err) {
    console.error('[API] Export start error:', err);
    return NextResponse.json(
      { error: 'Failed to start export' },
      { status: 500 }
    );
  }
}
