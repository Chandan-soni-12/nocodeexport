// ============================================================
// NoCodeExport — Shared TypeScript Types
// ============================================================

/** Supported export statuses */
export type ExportStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

/** User subscription plan */
export type UserPlan = 'FREE' | 'PRO' | 'LIFETIME';

/** Deployment platform */
export type DeployPlatform = 'NETLIFY' | 'VERCEL' | 'GITHUB_PAGES';

/** Deployment status */
export type DeployStatus = 'DEPLOYING' | 'DEPLOYED' | 'FAILED';

// ============================================================
// Crawler Types
// ============================================================

/** Discovered page with depth metadata */
export interface DiscoveredPage {
  url: string;
  depth: number;
  slug: string;
}

/** Map of original URL → local file path */
export type AssetMap = Map<string, string>;

/** Result of a single page capture */
export interface PageCaptureResult {
  url: string;
  slug: string;
  htmlPath: string;
  assetsDownloaded: number;
  success: boolean;
  error?: string;
}

/** Final export result from the crawler */
export interface ExportResult {
  outputDir: string;
  pageCount: number;
  assetCount: number;
  sizeBytes: number;
  pages: PageCaptureResult[];
  errors: string[];
}

/** Progress callback payload */
export interface ProgressUpdate {
  stage: 'discovering' | 'capturing' | 'processing' | 'packaging' | 'complete' | 'error';
  message: string;
  progress: number; // 0-100
  currentPage?: number;
  totalPages?: number;
  pageUrl?: string;
}

/** Crawler configuration */
export interface CrawlerConfig {
  maxPages: number;
  timeout: number;
  parallelBatches: number;
  waitAfterLoad: number;
  scrollDelay: number;
  scrollStep: number;
  retryAttempts: number;
  retryDelay: number;
}

/** Default crawler configuration */
export const DEFAULT_CRAWLER_CONFIG: CrawlerConfig = {
  maxPages: 100,
  timeout: 300000, // 5 minutes
  parallelBatches: 3,
  waitAfterLoad: 3000,
  scrollDelay: 100,
  scrollStep: 200,
  retryAttempts: 3,
  retryDelay: 1000,
};

// ============================================================
// API Types
// ============================================================

/** POST /api/export/start request body */
export interface StartExportRequest {
  url: string;
}

/** POST /api/export/start response */
export interface StartExportResponse {
  exportId: string;
  statusUrl: string;
}

/** SSE progress event data */
export interface SSEProgressEvent {
  status: ExportStatus;
  progress: number;
  message: string;
  pageCount?: number;
  assetCount?: number;
  sizeBytes?: number;
  zipReady?: boolean;
  error?: string;
}

/** POST /api/deploy/netlify request */
export interface DeployRequest {
  exportId: string;
  siteName: string;
}

/** POST /api/deploy/netlify response */
export interface DeployResponse {
  deployId: string;
  deployUrl: string;
  status: DeployStatus;
}

/** POST /api/checkout request */
export interface CheckoutRequest {
  plan: 'PRO' | 'LIFETIME';
}

/** Export job data for BullMQ */
export interface ExportJobData {
  exportId: string;
  url: string;
  userId: string;
}
