// ============================================================
// animationCapture.ts — Preserve Framer Motion animations
// Blocks telemetry while keeping essential animation scripts
// ============================================================

import { Page } from 'playwright';

/** Telemetry domains to block (these are NOT needed for animations) */
const TELEMETRY_DOMAINS = [
  'events.framer.com',
  'analytics.framer.com',
  'google-analytics.com',
  'googletagmanager.com',
  'facebook.net',
  'connect.facebook.net',
  'hotjar.com',
  'segment.com',
  'mixpanel.com',
  'amplitude.com',
  'posthog.com',
];

/** Telemetry beacon shim — disables sendBeacon for tracking domains */
const BEACON_SHIM = `
  const originalSendBeacon = navigator.sendBeacon?.bind(navigator);
  if (originalSendBeacon) {
    navigator.sendBeacon = function(url, data) {
      const blocked = ${JSON.stringify(TELEMETRY_DOMAINS)};
      try {
        const urlObj = new URL(url, window.location.origin);
        if (blocked.some(domain => urlObj.hostname.includes(domain))) {
          return true; // Pretend it succeeded
        }
      } catch {}
      return originalSendBeacon(url, data);
    };
  }
`;

/**
 * Set up telemetry blocking on a page
 * Must be called BEFORE navigation
 */
export async function setupTelemetryBlocking(page: Page): Promise<void> {
  // Block telemetry requests at the network level
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    const shouldBlock = TELEMETRY_DOMAINS.some((domain) => url.includes(domain));
    
    if (shouldBlock) {
      await route.abort('blockedbyclient');
    } else {
      await route.continue();
    }
  });

  // Inject beacon shim
  await page.addInitScript(BEACON_SHIM);
}

/**
 * Wait for page to fully settle (animations initialize, lazy content loads)
 */
export async function waitForPageSettle(page: Page, extraWaitMs = 3000): Promise<void> {
  // Wait for network idle
  try {
    await page.waitForLoadState('networkidle', { timeout: 30000 });
  } catch {
    // Network might never fully idle on some sites — that's OK
  }

  // Wait for DOM to be stable
  try {
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
  } catch {
    // Already loaded
  }

  // Extra wait for Framer Motion animations to initialize
  await page.waitForTimeout(extraWaitMs);
}

/**
 * Auto-scroll to trigger scroll-activated animations
 * Scrolls down slowly, then back to top
 */
export async function triggerScrollAnimations(
  page: Page,
  scrollStep = 200,
  scrollDelay = 100
): Promise<void> {
  try {
    // Get page height
    const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
    
    // Scroll down incrementally
    let currentScroll = 0;
    while (currentScroll < scrollHeight) {
      currentScroll += scrollStep;
      await page.evaluate((y) => window.scrollTo(0, y), currentScroll);
      await page.waitForTimeout(scrollDelay);
    }

    // Small wait at bottom for any final animations
    await page.waitForTimeout(500);

    // Scroll back to top
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
  } catch {
    // Scroll failed — not critical
  }
}

export { TELEMETRY_DOMAINS };
