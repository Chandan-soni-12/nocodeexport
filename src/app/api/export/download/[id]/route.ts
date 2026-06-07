// ============================================================
// GET /api/export/download/[id] — Download exported ZIP
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Look up export record
    const exportRecord = await db.export.findUnique({
      where: { id },
    });

    if (!exportRecord) {
      return NextResponse.json({ error: 'Export not found' }, { status: 404 });
    }

    if (exportRecord.status !== 'COMPLETED' || !exportRecord.zipPath) {
      return NextResponse.json(
        { error: 'Export is not ready for download' },
        { status: 400 }
      );
    }

    // Check if file exists
    try {
      await fsp.access(exportRecord.zipPath);
    } catch {
      return NextResponse.json(
        { error: 'ZIP file not found on disk' },
        { status: 404 }
      );
    }

    // Get file stats
    const stats = await fsp.stat(exportRecord.zipPath);

    // Generate a clean filename from the source URL
    let filename = 'export';
    try {
      const url = new URL(exportRecord.sourceUrl);
      filename = url.hostname.replace(/\./g, '-');
    } catch {
      // Use default filename
    }

    // Stream the file
    const fileStream = fs.createReadStream(exportRecord.zipPath);
    const readableStream = new ReadableStream({
      start(controller) {
        fileStream.on('data', (chunk: any) => {
          controller.enqueue(new Uint8Array(chunk));
        });
        fileStream.on('end', () => {
          controller.close();
        });
        fileStream.on('error', (err) => {
          controller.error(err);
        });
      },
      cancel() {
        fileStream.destroy();
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}.zip"`,
        'Content-Length': stats.size.toString(),
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (err) {
    console.error('[API] Download error:', err);
    return NextResponse.json(
      { error: 'Failed to download export' },
      { status: 500 }
    );
  }
}
