// ============================================================
// POST /api/deploy/netlify — One-click Netlify deployment
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { deployToNetlify } from '@/lib/netlify';

const DeploySchema = z.object({
  exportId: z.string().min(1),
  siteName: z.string().min(1).max(63).regex(/^[a-z0-9-]+$/, 'Site name must be lowercase alphanumeric with hyphens'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = DeploySchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.issues[0].message },
        { status: 400 }
      );
    }

    const { exportId, siteName } = validated.data;

    // Check if Netlify token is configured
    if (!process.env.NETLIFY_API_TOKEN) {
      return NextResponse.json(
        { error: 'Netlify API token not configured' },
        { status: 503 }
      );
    }

    // Find the export
    const exportRecord = await db.export.findUnique({
      where: { id: exportId },
    });

    if (!exportRecord || exportRecord.status !== 'COMPLETED' || !exportRecord.zipPath) {
      return NextResponse.json(
        { error: 'Export not found or not ready' },
        { status: 400 }
      );
    }

    // Deploy to Netlify
    const result = await deployToNetlify(exportRecord.zipPath, siteName);

    // Save deployment record
    const deployment = await db.deployment.create({
      data: {
        exportId,
        platform: 'NETLIFY',
        deployUrl: result.url,
        status: 'DEPLOYED',
      },
    });

    return NextResponse.json({
      deployId: deployment.id,
      deployUrl: result.url,
      status: 'DEPLOYED',
    });
  } catch (err) {
    console.error('[API] Netlify deploy error:', err);
    return NextResponse.json(
      { error: 'Deployment failed' },
      { status: 500 }
    );
  }
}
