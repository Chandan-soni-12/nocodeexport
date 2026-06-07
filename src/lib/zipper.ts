// ============================================================
// zipper.ts — Package output directory as downloadable ZIP
// Uses archiver for streaming compression
// ============================================================

import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
interface ZipResult {
  zipPath: string;
  sizeBytes: number;
}

/**
 * Create a ZIP archive from an output directory
 */
export async function createZip(
  outputDir: string,
  zipPath: string
): Promise<ZipResult> {
  // Ensure exports directory exists
  await fsp.mkdir(path.dirname(zipPath), { recursive: true });

  // Dynamically import archiver at runtime
  const { ZipArchive } = (await import('archiver')) as any;

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    if (!ZipArchive) {
      return reject(new Error('Archiver module ZipArchive is not loaded'));
    }
    const archive = new ZipArchive({
      zlib: { level: 9 }, // Maximum compression
    });

    let finalSize = 0;

    output.on('close', () => {
      finalSize = archive.pointer();
      resolve({
        zipPath,
        sizeBytes: finalSize,
      });
    });

    output.on('error', (err: any) => {
      reject(new Error(`ZIP write error: ${err.message}`));
    });

    archive.on('error', (err: any) => {
      reject(new Error(`ZIP archive error: ${err.message}`));
    });

    archive.on('warning', (err: any) => {
      if (err.code === 'ENOENT') {
        // File not found — skip it
        console.warn(`ZIP warning: ${err.message}`);
      } else {
        reject(err);
      }
    });

    // Pipe archive data to the output file
    archive.pipe(output);

    // Add all files from the output directory
    archive.directory(outputDir, false);

    // Finalize the archive
    archive.finalize();
  });
}
