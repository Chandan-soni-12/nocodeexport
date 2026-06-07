// ============================================================
// htmlCleaner.ts — Strip trackers, watermarks, and platform cruft
// Produces clean HTML free from Framer telemetry and branding
// ============================================================

import * as cheerio from 'cheerio';

/** Tracking script domains to remove */
const TRACKER_DOMAINS = [
  'google-analytics.com',
  'googletagmanager.com',
  'www.googletagmanager.com',
  'gtag',
  'facebook.net',
  'connect.facebook.net',
  'hotjar.com',
  'static.hotjar.com',
  'segment.com',
  'cdn.segment.com',
  'mixpanel.com',
  'cdn.mixpanel.com',
  'amplitude.com',
  'cdn.amplitude.com',
  'posthog.com',
  'app.posthog.com',
  'events.framer.com',
  'analytics.framer.com',
  'plausible.io',
  'js.hs-scripts.com',
  'js.hs-analytics.net',
  'snap.licdn.com',
  'bat.bing.com',
  'clarity.ms',
];

/** Inline tracking patterns to detect in script content */
const INLINE_TRACKER_PATTERNS = [
  'google-analytics.com',
  'googletagmanager.com',
  'gtag(',
  'fbq(',
  'hotjar.com',
  '_hj(',
  'analytics.track',
  'segment.com',
  'mixpanel.track',
  'amplitude.getInstance',
  'posthog.capture',
  'events.framer.com',
];

/** Watermark selectors to remove */
const WATERMARK_SELECTORS = [
  '[class*="framer-badge"]',
  'a[href*="framer.com?via"]',
  'a[href*="framer.link"]',
  '[data-framer-name="Badge"]',
  '[data-framer-name="Framer Badge"]',
  '[class*="Badge"]',
];

/**
 * Clean HTML content — remove trackers, watermarks, and platform artifacts
 */
export function cleanHtml(html: string): string {
  const $ = cheerio.load(html);

  // 1. Remove tracking scripts
  removeTrackingScripts($);

  // 2. Remove watermark elements
  removeWatermarks($);

  // 3. Remove meta generator tags
  removeMetaGenerator($);

  // 4. Remove service worker registrations
  removeServiceWorkers($);

  // 5. Remove CSP meta tags that might block local assets
  removeCspMeta($);

  // 6. Remove noscript tracking pixels
  removeTrackingPixels($);

  return $.html();
}

/**
 * Remove all tracking/analytics scripts
 */
function removeTrackingScripts($: cheerio.CheerioAPI): void {
  // Remove scripts with tracking src
  $('script[src]').each((_, el) => {
    const src = $(el).attr('src') || '';
    if (TRACKER_DOMAINS.some((domain) => src.includes(domain))) {
      $(el).remove();
    }
  });

  // Remove inline scripts containing tracking code
  $('script:not([src])').each((_, el) => {
    const content = $(el).html() || '';
    if (INLINE_TRACKER_PATTERNS.some((pattern) => content.includes(pattern))) {
      $(el).remove();
    }
  });

  // Remove tracking link preconnects
  $('link[rel="preconnect"], link[rel="dns-prefetch"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (TRACKER_DOMAINS.some((domain) => href.includes(domain))) {
      $(el).remove();
    }
  });
}

/**
 * Remove Framer watermark/badge elements
 */
function removeWatermarks($: cheerio.CheerioAPI): void {
  for (const selector of WATERMARK_SELECTORS) {
    try {
      $(selector).remove();
    } catch {
      // Invalid selector — skip
    }
  }

  // Remove any <a> elements with text "Made in Framer" or "Built with Framer"
  $('a').each((_, el) => {
    const text = $(el).text().trim().toLowerCase();
    if (
      text.includes('made in framer') ||
      text.includes('built with framer') ||
      text.includes('made with framer') ||
      text === 'framer'
    ) {
      const href = $(el).attr('href') || '';
      if (href.includes('framer.com') || href.includes('framer.link')) {
        $(el).remove();
      }
    }
  });

  // Remove badge containers (often the parent div of watermark links)
  $('[data-framer-component-type="Badge"]').remove();
}

/**
 * Remove meta generator tags
 */
function removeMetaGenerator($: cheerio.CheerioAPI): void {
  $('meta[name="generator"]').remove();
  $('meta[content*="Framer"]').each((_, el) => {
    const name = $(el).attr('name') || '';
    if (name === 'generator') {
      $(el).remove();
    }
  });
}

/**
 * Remove service worker registration scripts
 */
function removeServiceWorkers($: cheerio.CheerioAPI): void {
  $('script:not([src])').each((_, el) => {
    const content = $(el).html() || '';
    if (
      content.includes('serviceWorker.register') ||
      content.includes('navigator.serviceWorker')
    ) {
      $(el).remove();
    }
  });
}

/**
 * Remove Content-Security-Policy meta tags
 */
function removeCspMeta($: cheerio.CheerioAPI): void {
  $('meta[http-equiv="Content-Security-Policy"]').remove();
}

/**
 * Remove tracking pixels (usually in noscript tags)
 */
function removeTrackingPixels($: cheerio.CheerioAPI): void {
  $('noscript').each((_, el) => {
    const content = $(el).html() || '';
    if (
      TRACKER_DOMAINS.some((domain) => content.includes(domain)) ||
      content.includes('facebook.com/tr') ||
      content.includes('bat.bing.com')
    ) {
      $(el).remove();
    }
  });

  // Remove 1x1 tracking images
  $('img').each((_, el) => {
    const src = $(el).attr('src') || '';
    const width = $(el).attr('width');
    const height = $(el).attr('height');
    
    if (
      (width === '1' && height === '1') ||
      (width === '0' && height === '0')
    ) {
      if (TRACKER_DOMAINS.some((domain) => src.includes(domain))) {
        $(el).remove();
      }
    }
  });
}
