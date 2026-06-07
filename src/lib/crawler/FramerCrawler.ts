// ============================================================
// FramerCrawler.ts — Main orchestrator for Framer site export
// Coordinates all crawler modules into a complete export pipeline
// ============================================================

import * as fs from 'fs/promises';
import * as path from 'path';
import type { Browser, BrowserContext } from 'playwright';
import type {
  ExportResult,
  ProgressUpdate,
  DiscoveredPage,
  PageCaptureResult,
  CrawlerConfig,
} from '@/types';
import { launchStealthBrowser, createStealthContext, createStealthPage } from './stealth';
import { discoverPages } from './pageDiscovery';
import { AssetCapture } from './assetCapture';
import { setupTelemetryBlocking, waitForPageSettle, triggerScrollAnimations } from './animationCapture';
import { processCssFiles } from './cssProcessor';
import { cleanHtml } from './htmlCleaner';
import { rewritePaths } from './pathRewriter';
import { rewriteForms } from './formRewriter';

type ProgressCallback = (update: ProgressUpdate) => void;

/**
 * FramerCrawler — Main class for exporting Framer sites to static HTML
 */
export class FramerCrawler {
  private url: string;
  private outputDir: string;
  private onProgress: ProgressCallback;
  private config: CrawlerConfig;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;

  constructor(
    url: string,
    outputDir: string,
    onProgress: ProgressCallback,
    config?: Partial<CrawlerConfig>
  ) {
    this.url = url;
    this.outputDir = outputDir;
    this.onProgress = onProgress;
    this.config = {
      maxPages: config?.maxPages ?? 100,
      timeout: config?.timeout ?? 300000,
      parallelBatches: config?.parallelBatches ?? 3,
      waitAfterLoad: config?.waitAfterLoad ?? 3000,
      scrollDelay: config?.scrollDelay ?? 100,
      scrollStep: config?.scrollStep ?? 200,
      retryAttempts: config?.retryAttempts ?? 3,
      retryDelay: config?.retryDelay ?? 1000,
    };
  }

  /**
   * Execute the full export pipeline
   */
  async export(): Promise<ExportResult> {
    const errors: string[] = [];
    const pageResults: PageCaptureResult[] = [];
    const assetCapture = new AssetCapture(this.outputDir);

    try {
      // Create output directories
      await fs.mkdir(this.outputDir, { recursive: true });
      await fs.mkdir(path.join(this.outputDir, 'assets'), { recursive: true });

      // ── Step 1: Launch browser ──────────────────────────────
      this.emitProgress('discovering', 'Launching browser...', 2);
      this.browser = await launchStealthBrowser();
      this.context = await createStealthContext(this.browser);

      // ── Step 2: Discover pages ──────────────────────────────
      this.emitProgress('discovering', 'Discovering pages...', 5);
      const pages = await discoverPages(this.url, this.config.maxPages);
      this.emitProgress('discovering', `Found ${pages.length} page(s)`, 10);

      if (pages.length === 0) {
        throw new Error('No pages found on the site');
      }

      // ── Step 3: Capture pages ───────────────────────────────
      const totalPages = pages.length;
      let capturedPages = 0;

      // Process pages in parallel batches
      for (let i = 0; i < pages.length; i += this.config.parallelBatches) {
        const batch = pages.slice(i, i + this.config.parallelBatches);
        
        const batchResults = await Promise.allSettled(
          batch.map((page) =>
            this.capturePage(page, assetCapture)
          )
        );

        for (let j = 0; j < batchResults.length; j++) {
          const result = batchResults[j];
          capturedPages++;

          if (result.status === 'fulfilled') {
            pageResults.push(result.value);
            if (!result.value.success) {
              errors.push(`Page ${batch[j].url}: ${result.value.error}`);
            }
          } else {
            const errorMsg = result.reason?.message || 'Unknown error';
            errors.push(`Page ${batch[j].url}: ${errorMsg}`);
            pageResults.push({
              url: batch[j].url,
              slug: batch[j].slug,
              htmlPath: '',
              assetsDownloaded: 0,
              success: false,
              error: errorMsg,
            });
          }

          const progressPct = 10 + Math.floor((capturedPages / totalPages) * 60);
          this.emitProgress(
            'capturing',
            `Captured page ${capturedPages}/${totalPages}: ${batch[j]?.slug || 'unknown'}`,
            progressPct,
            capturedPages,
            totalPages,
            batch[j]?.url
          );
        }
      }

      // Wait for all asset downloads to complete
      this.emitProgress('processing', 'Downloading remaining assets...', 72);
      await assetCapture.waitForDownloads();

      // ── Step 4: Process CSS ─────────────────────────────────
      this.emitProgress('processing', 'Processing CSS files...', 75);
      const assetMap = assetCapture.getAssetMap();
      await processCssFiles(this.outputDir, assetCapture, assetMap);

      // ── Step 5: Clean and rewrite HTML ──────────────────────
      this.emitProgress('processing', 'Cleaning HTML and rewriting paths...', 80);
      for (const result of pageResults) {
        if (!result.success || !result.htmlPath) continue;

        try {
          let html = await fs.readFile(result.htmlPath, 'utf-8');
          
          // Clean trackers and watermarks
          html = cleanHtml(html);
          
          // Rewrite asset paths to local
          html = rewritePaths(html, assetMap, pages, result.slug);
          
          // Rewrite forms
          html = rewriteForms(html);
          
          await fs.writeFile(result.htmlPath, html);
        } catch (err) {
          errors.push(`Failed to process ${result.slug}: ${(err as Error).message}`);
        }
      }

      // ── Step 6: Generate support files ──────────────────────
      this.emitProgress('processing', 'Generating support files...', 90);
      await this.generateSupportFiles(pages);

      // ── Step 7: Calculate final stats ───────────────────────
      this.emitProgress('processing', 'Finalizing...', 95);
      const sizeBytes = await calculateDirSize(this.outputDir);

      // Close browser
      await this.cleanup();

      const result: ExportResult = {
        outputDir: this.outputDir,
        pageCount: pageResults.filter((r) => r.success).length,
        assetCount: assetCapture.getAssetCount(),
        sizeBytes,
        pages: pageResults,
        errors,
      };

      this.emitProgress('complete', 'Export complete!', 100);
      return result;
    } catch (err) {
      await this.cleanup();
      const errorMessage = (err as Error).message || 'Export failed';
      this.emitProgress('error', errorMessage, 0);
      throw err;
    }
  }

  /**
   * Capture a single page — navigate, scroll, extract HTML
   */
  private async capturePage(
    page: DiscoveredPage,
    assetCapture: AssetCapture
  ): Promise<PageCaptureResult> {
    if (!this.context) throw new Error('Browser context not initialized');

    const browserPage = await createStealthPage(this.context);

    try {
      // Attach asset interception BEFORE navigation
      assetCapture.attachToPage(browserPage);

      // Set up telemetry blocking
      await setupTelemetryBlocking(browserPage);

      // Navigate to the page
      await browserPage.goto(page.url, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });

      // Wait for page to settle (animations, lazy content)
      await waitForPageSettle(browserPage, this.config.waitAfterLoad);

      // Trigger scroll animations
      await triggerScrollAnimations(
        browserPage,
        this.config.scrollStep,
        this.config.scrollDelay
      );

      // Capture rendered HTML
      const html = await browserPage.content();

      // Save HTML file
      const filename = page.slug === 'index' ? 'index.html' : `${page.slug}.html`;
      const htmlPath = path.join(this.outputDir, filename);
      await fs.writeFile(htmlPath, html);

      return {
        url: page.url,
        slug: page.slug,
        htmlPath,
        assetsDownloaded: assetCapture.getAssetCount(),
        success: true,
      };
    } catch (err) {
      return {
        url: page.url,
        slug: page.slug,
        htmlPath: '',
        assetsDownloaded: 0,
        success: false,
        error: (err as Error).message,
      };
    } finally {
      try {
        await browserPage.close();
      } catch {
        // Page might already be closed
      }
    }
  }

  /**
   * Generate support files (_redirects, robots.txt, etc.)
   */
  private async generateSupportFiles(pages: DiscoveredPage[]): Promise<void> {
    // _redirects file for Netlify
    const redirects = pages
      .filter((p) => p.slug !== 'index')
      .map((p) => `/${p.slug.replace(/-/g, '/')} /${p.slug}.html 200`)
      .join('\n');

    await fs.writeFile(
      path.join(this.outputDir, '_redirects'),
      `# Auto-generated redirects for Netlify\n${redirects}\n/* /index.html 200\n`
    );

    // robots.txt
    await fs.writeFile(
      path.join(this.outputDir, 'robots.txt'),
      `User-agent: *\nAllow: /\n\nSitemap: /sitemap.xml\n`
    );

    // Basic 404 page
    const notFoundHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Page Not Found</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0a0a0a; color: #fafafa; }
    .container { text-align: center; }
    h1 { font-size: 6rem; margin: 0; font-weight: 200; }
    p { color: #888; font-size: 1.125rem; }
    a { color: #0066FF; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <h1>404</h1>
    <p>This page could not be found.</p>
    <p><a href="./index.html">← Go back home</a></p>
  </div>
</body>
</html>`;

    await fs.writeFile(path.join(this.outputDir, '404.html'), notFoundHtml);
  }

  /**
   * Emit a progress update
   */
  private emitProgress(
    stage: ProgressUpdate['stage'],
    message: string,
    progress: number,
    currentPage?: number,
    totalPages?: number,
    pageUrl?: string
  ): void {
    this.onProgress({
      stage,
      message,
      progress,
      currentPage,
      totalPages,
      pageUrl,
    });
  }

  /**
   * Clean up browser resources
   */
  private async cleanup(): Promise<void> {
    try {
      if (this.context) {
        await this.context.close();
        this.context = null;
      }
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
    } catch {
      // Cleanup errors are non-critical
    }
  }
}

/**
 * Calculate total size of a directory recursively
 */
async function calculateDirSize(dirPath: string): Promise<number> {
  let totalSize = 0;

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        totalSize += await calculateDirSize(fullPath);
      } else {
        const stat = await fs.stat(fullPath);
        totalSize += stat.size;
      }
    }
  } catch {
    // Directory read error
  }

  return totalSize;
}

export { calculateDirSize };
