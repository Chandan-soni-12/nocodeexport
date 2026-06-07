// ============================================================
// assetCapture.ts — Network-level asset interception & download
// Captures images, fonts, CSS, JS, video via Playwright response listener
// ============================================================

import { Page, Response as PlaywrightResponse } from 'playwright';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import axios from 'axios';
import type { AssetMap } from '@/types';

/** Content types we want to capture */
const CAPTURABLE_TYPES = [
  'image/',
  'font/',
  'text/css',
  'application/javascript',
  'text/javascript',
  'application/x-javascript',
  'video/',
  'audio/',
  'application/font',
  'application/x-font',
  'application/vnd.ms-fontobject',
];

/** Extensions from content type */
const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/x-icon': 'ico',
  'font/woff2': 'woff2',
  'font/woff': 'woff',
  'font/ttf': 'ttf',
  'font/otf': 'otf',
  'application/font-woff2': 'woff2',
  'application/font-woff': 'woff',
  'application/x-font-ttf': 'ttf',
  'application/x-font-otf': 'otf',
  'application/vnd.ms-fontobject': 'eot',
  'text/css': 'css',
  'application/javascript': 'js',
  'text/javascript': 'js',
  'application/x-javascript': 'js',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'audio/mpeg': 'mp3',
};

/**
 * Asset capture system — intercepts network responses and downloads assets
 */
export class AssetCapture {
  private assetMap: AssetMap = new Map();
  private downloadedUrls = new Set<string>();
  private assetsDir: string;
  private pendingDownloads: Promise<void>[] = [];

  constructor(outputDir: string) {
    this.assetsDir = path.join(outputDir, 'assets');
  }

  /** Get the accumulated asset map */
  getAssetMap(): AssetMap {
    return this.assetMap;
  }

  /** Get count of downloaded assets */
  getAssetCount(): number {
    return this.downloadedUrls.size;
  }

  /**
   * Attach response listener to a page BEFORE navigation
   * This ensures we catch all network assets
   */
  attachToPage(page: Page): void {
    page.on('response', async (response: PlaywrightResponse) => {
      try {
        await this.handleResponse(response);
      } catch {
        // Silently skip failed asset captures
      }
    });
  }

  /**
   * Handle a network response — download if it's a capturable asset
   */
  private async handleResponse(response: PlaywrightResponse): Promise<void> {
    const url = response.url();
    const status = response.status();

    // Skip non-success responses
    if (status < 200 || status >= 400) return;

    // Skip data: URIs
    if (url.startsWith('data:')) return;

    // Skip already-downloaded URLs
    if (this.downloadedUrls.has(url)) return;

    // Check content type
    const contentType = response.headers()['content-type'] || '';
    const isCapturable = CAPTURABLE_TYPES.some((type) =>
      contentType.toLowerCase().startsWith(type)
    );

    if (!isCapturable) return;

    // Mark as seen immediately to prevent duplicates
    this.downloadedUrls.add(url);

    // Determine local filename
    const localPath = this.urlToLocalPath(url, contentType);
    this.assetMap.set(url, localPath);

    // Download in background
    const downloadPromise = this.downloadAsset(response, url, localPath);
    this.pendingDownloads.push(downloadPromise);
  }

  /**
   * Wait for all pending downloads to complete
   */
  async waitForDownloads(): Promise<void> {
    await Promise.allSettled(this.pendingDownloads);
    this.pendingDownloads = [];
  }

  /**
   * Download an asset from a Playwright response
   */
  private async downloadAsset(
    response: PlaywrightResponse,
    url: string,
    localPath: string
  ): Promise<void> {
    const fullPath = path.join(this.assetsDir, localPath);
    const dir = path.dirname(fullPath);

    try {
      await fs.mkdir(dir, { recursive: true });

      // Try to get body from Playwright response first
      let buffer: Buffer;
      try {
        buffer = await response.body();
      } catch {
        // If Playwright can't provide the body, download via axios
        buffer = await this.downloadWithRetry(url);
      }

      await fs.writeFile(fullPath, buffer);
    } catch {
      // Remove from asset map if download failed
      this.assetMap.delete(url);
      this.downloadedUrls.delete(url);
    }
  }

  /**
   * Download a URL with retry logic (3 attempts, exponential backoff)
   */
  async downloadWithRetry(url: string, attempts = 3): Promise<Buffer> {
    let lastError: Error | undefined;

    for (let i = 0; i < attempts; i++) {
      try {
        const response = await axios.get(url, {
          responseType: 'arraybuffer',
          timeout: 30000,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          },
        });
        return Buffer.from(response.data);
      } catch (err) {
        lastError = err as Error;
        // Exponential backoff: 1s, 2s, 4s
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, i)));
      }
    }

    throw lastError || new Error(`Failed to download ${url}`);
  }

  /**
   * Download an asset by URL (for CSS-referenced assets not caught by network interception)
   */
  async downloadExternalAsset(url: string): Promise<string | null> {
    if (this.downloadedUrls.has(url)) {
      return this.assetMap.get(url) || null;
    }

    try {
      const buffer = await this.downloadWithRetry(url);
      const contentType = guessContentType(url);
      const localPath = this.urlToLocalPath(url, contentType);
      const fullPath = path.join(this.assetsDir, localPath);

      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, buffer);

      this.assetMap.set(url, localPath);
      this.downloadedUrls.add(url);

      return localPath;
    } catch {
      return null;
    }
  }

  /**
   * Convert a URL to a local filename
   * Preserves relative paths and directory hierarchies for ESM modules compatibility
   */
  private urlToLocalPath(url: string, contentType: string): string {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname;
      let pathname = decodeURIComponent(parsed.pathname);

      // If pathname ends with a slash or is empty, use a default filename
      if (pathname.endsWith('/') || !pathname) {
        pathname += 'index';
      }

      // Replace backslashes with forward slashes for consistency
      let cleanPath = pathname.replace(/\\/g, '/');

      // Sanitize Windows forbidden characters: : * ? " < > |
      cleanPath = cleanPath.replace(/[:*?"<>|]/g, '_');

      // Check if the file has an extension
      let ext = path.extname(cleanPath).toLowerCase().replace('.', '');
      
      // If it doesn't have a valid extension, guess one and append it
      if (!ext || ext.length > 5) {
        const guessedExt = getExtension(url, contentType);
        cleanPath += `.${guessedExt}`;
      }

      // Return host + cleanPath (without leading slash)
      const relativePath = path.join(host, cleanPath.startsWith('/') ? cleanPath.substring(1) : cleanPath);
      return relativePath.replace(/\\/g, '/'); // Ensure forward slashes for HTML/CSS links
    } catch {
      // Fallback to MD5 hashing if URL is invalid
      const hash = crypto.createHash('md5').update(url).digest('hex').substring(0, 8);
      const ext = getExtension(url, contentType);
      return `other/${hash}.${ext}`;
    }
  }
}

/**
 * Get file extension from URL or content type
 */
function getExtension(url: string, contentType: string): string {
  // Try from content type first
  const ctLower = contentType.toLowerCase().split(';')[0].trim();
  if (CONTENT_TYPE_EXTENSIONS[ctLower]) {
    return CONTENT_TYPE_EXTENSIONS[ctLower];
  }

  // Try from URL
  try {
    const pathname = new URL(url).pathname;
    const ext = path.extname(pathname).replace('.', '').toLowerCase();
    if (ext && ext.length <= 5) return ext;
  } catch {
    // Invalid URL
  }

  // Fallback based on content type prefix
  if (ctLower.startsWith('image/')) return 'png';
  if (ctLower.startsWith('font/')) return 'woff2';
  if (ctLower.startsWith('text/css')) return 'css';
  if (ctLower.includes('javascript')) return 'js';
  if (ctLower.startsWith('video/')) return 'mp4';

  return 'bin';
}

/**
 * Categorize asset into a subdirectory based on content type
 */
function getAssetCategory(contentType: string): string {
  const ct = contentType.toLowerCase();
  if (ct.startsWith('image/')) return 'images';
  if (ct.startsWith('font/') || ct.includes('font')) return 'fonts';
  if (ct.includes('css')) return 'css';
  if (ct.includes('javascript')) return 'js';
  if (ct.startsWith('video/') || ct.startsWith('audio/')) return 'media';
  return 'other';
}

/**
 * Guess content type from URL extension
 */
function guessContentType(url: string): string {
  try {
    const ext = path.extname(new URL(url).pathname).toLowerCase();
    const map: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp',
      '.avif': 'image/avif',
      '.ico': 'image/x-icon',
      '.woff2': 'font/woff2',
      '.woff': 'font/woff',
      '.ttf': 'font/ttf',
      '.otf': 'font/otf',
      '.eot': 'application/vnd.ms-fontobject',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mp3': 'audio/mpeg',
    };
    return map[ext] || 'application/octet-stream';
  } catch {
    return 'application/octet-stream';
  }
}

export { guessContentType, getExtension };
