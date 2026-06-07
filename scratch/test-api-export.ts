// ============================================================
// test-api-export.ts — End-to-end API integration test
// ============================================================

import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';
import { db } from '../src/lib/db';

async function runApiTest() {
  const testUrl = 'https://example.com';
  console.log(`Sending export request for ${testUrl} to http://localhost:3000/api/export/start...`);

  try {
    // Step 1: Start Export
    const startResponse = await axios.post('http://localhost:3000/api/export/start', {
      url: testUrl,
    });

    const { exportId, statusUrl } = startResponse.data;
    console.log(`Export successfully queued! ID: ${exportId}`);
    console.log(`Status URL: ${statusUrl}`);

    // Step 2: Poll status endpoint to check database state and progress updates
    console.log('Polling export status...');
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds max wait time
    let completed = false;

    while (attempts < maxAttempts) {
      const record = await db.export.findUnique({
        where: { id: exportId },
      });

      if (!record) {
        throw new Error('Export record not found in database');
      }

      console.log(`[Status check] Status: ${record.status} | Progress: ${record.progress}% | Message: ${record.progressMessage}`);

      if (record.status === 'COMPLETED') {
        completed = true;
        console.log(`✓ Export job completed on DB! ZIP file path: ${record.zipPath}`);
        
        // Verify ZIP file exists
        if (record.zipPath) {
          const fileExists = await fs.access(record.zipPath).then(() => true).catch(() => false);
          if (fileExists) {
            const stat = await fs.stat(record.zipPath);
            console.log(`✓ ZIP file successfully generated! Size: ${(stat.size / 1024).toFixed(2)} KB`);
          } else {
            console.error('✗ ZIP file was not found at path:', record.zipPath);
          }
        }
        break;
      }

      if (record.status === 'FAILED') {
        console.error(`✗ Export job failed on DB: ${record.errorMessage}`);
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
      attempts++;
    }

    if (!completed) {
      console.error('✗ Test timed out before export could complete');
    }

  } catch (err: any) {
    console.error('✗ API Test failed with error:', err.message);
    if (err.response) {
      console.error('Response data:', err.response.data);
    }
  }
}

runApiTest();
