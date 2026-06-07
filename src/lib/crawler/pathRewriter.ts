// ============================================================
// pathRewriter.ts — Convert absolute URLs to relative paths
// Rewrites src, href, srcset, inline styles, and CSS references
// ============================================================

import * as cheerio from 'cheerio';
import type { AssetMap, DiscoveredPage } from '@/types';

/**
 * Rewrite all absolute URLs in HTML to relative local paths
 */
export function rewritePaths(
  html: string,
  assetMap: AssetMap,
  pages: DiscoveredPage[],
  currentSlug: string
): string {
  const $ = cheerio.load(html);

  // Calculate prefix based on current slug depth (e.g. blog/post-1 -> ../assets/)
  const cleanSlug = currentSlug.replace(/^\/+|\/+$/g, '');
  // If slug is 'index', depth is 0. If 'blog/post-1', depth is 1
  const parts = cleanSlug ? cleanSlug.split('/') : [];
  const depth = parts.length > 1 ? parts.length - 1 : 0;
  const assetsPrefix = depth > 0 ? '../'.repeat(depth) + 'assets/' : 'assets/';

  // 1. Rewrite asset references in standard attributes
  rewriteAttributes($, assetMap, assetsPrefix);

  // 2. Rewrite srcset attributes
  rewriteSrcsets($, assetMap, assetsPrefix);

  // 3. Rewrite inline style background-image URLs
  rewriteInlineStyles($, assetMap, assetsPrefix);

  // 4. Rewrite CSS inside <style> tags
  rewriteStyleTags($, assetMap, assetsPrefix);

  // 5. Rewrite page-to-page links
  rewritePageLinks($, pages, currentSlug);

  // 6. Rewrite <link> stylesheet hrefs
  rewriteLinkTags($, assetMap, assetsPrefix);

  // 7. Rewrite <script> src
  rewriteScriptTags($, assetMap, assetsPrefix);

  return $.html();
}

/**
 * Rewrite src, href, poster, data-src attributes
 */
function rewriteAttributes($: cheerio.CheerioAPI, assetMap: AssetMap, assetsPrefix: string): void {
  const attrs = ['src', 'poster', 'data-src', 'data-srcset'];

  for (const attr of attrs) {
    $(`[${attr}]`).each((_, el) => {
      const value = $(el).attr(attr);
      if (!value) return;

      const localPath = findInAssetMap(value, assetMap);
      if (localPath) {
        $(el).attr(attr, `${assetsPrefix}${localPath}`);
      }
    });
  }
}

/**
 * Rewrite srcset attributes (multiple URLs with size descriptors)
 */
function rewriteSrcsets($: cheerio.CheerioAPI, assetMap: AssetMap, assetsPrefix: string): void {
  $('[srcset]').each((_, el) => {
    const srcset = $(el).attr('srcset');
    if (!srcset) return;

    const rewritten = srcset
      .split(',')
      .map((entry) => {
        const parts = entry.trim().split(/\s+/);
        const url = parts[0];
        const descriptor = parts.slice(1).join(' ');

        const localPath = findInAssetMap(url, assetMap);
        if (localPath) {
          return descriptor ? `${assetsPrefix}${localPath} ${descriptor}` : `${assetsPrefix}${localPath}`;
        }
        return entry.trim();
      })
      .join(', ');

    $(el).attr('srcset', rewritten);
  });
}

/**
 * Rewrite inline style background-image: url(...) references
 */
function rewriteInlineStyles($: cheerio.CheerioAPI, assetMap: AssetMap, assetsPrefix: string): void {
  $('[style]').each((_, el) => {
    let style = $(el).attr('style');
    if (!style) return;

    let modified = false;
    style = style.replace(/url\(\s*['"]?([^'")\s]+)['"]?\s*\)/g, (match, url) => {
      const localPath = findInAssetMap(url, assetMap);
      if (localPath) {
        modified = true;
        return `url('${assetsPrefix}${localPath}')`;
      }
      return match;
    });

    if (modified) {
      $(el).attr('style', style);
    }
  });
}

/**
 * Rewrite CSS url() references inside <style> tags
 */
function rewriteStyleTags($: cheerio.CheerioAPI, assetMap: AssetMap, assetsPrefix: string): void {
  $('style').each((_, el) => {
    let content = $(el).html();
    if (!content) return;

    let modified = false;
    content = content.replace(/url\(\s*['"]?([^'")\s]+)['"]?\s*\)/g, (match, url) => {
      if (url.startsWith('data:') || url.startsWith('#')) return match;

      const localPath = findInAssetMap(url, assetMap);
      if (localPath) {
        modified = true;
        return `url('${assetsPrefix}${localPath}')`;
      }
      return match;
    });

    if (modified) {
      $(el).html(content);
    }
  });
}

/**
 * Rewrite page-to-page links to local .html files
 */
function rewritePageLinks(
  $: cheerio.CheerioAPI,
  pages: DiscoveredPage[],
  currentSlug: string
): void {
  if (pages.length === 0) return;

  // Build a map of URL → slug
  const pageMap = new Map<string, string>();
  for (const page of pages) {
    try {
      const url = new URL(page.url);
      pageMap.set(url.pathname, page.slug);
      // Also map with trailing slash
      if (!url.pathname.endsWith('/')) {
        pageMap.set(url.pathname + '/', page.slug);
      }
    } catch {
      // Skip invalid URLs
    }
  }

  // Get the origin from first page
  let origin = '';
  try {
    origin = new URL(pages[0].url).origin;
  } catch {
    return;
  }

  // Calculate relative path back to root based on depth
  const cleanSlug = currentSlug.replace(/^\/+|\/+$/g, '');
  const parts = cleanSlug ? cleanSlug.split('/') : [];
  const depth = parts.length > 1 ? parts.length - 1 : 0;
  const rootRelativePrefix = depth > 0 ? '../'.repeat(depth) : './';

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;

    // Skip anchors, mailto, tel, external links
    if (
      href.startsWith('#') ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:') ||
      href.startsWith('javascript:')
    ) {
      return;
    }

    try {
      const resolved = new URL(href, origin);

      // Only rewrite same-origin links
      if (resolved.origin !== origin) return;

      const slug = pageMap.get(resolved.pathname);
      if (slug) {
        const targetFile = slug === 'index' ? 'index.html' : `${slug}.html`;
        const hash = resolved.hash || '';
        $(el).attr('href', `${rootRelativePrefix}${targetFile}${hash}`);
      }
    } catch {
      // Invalid URL — leave as-is
    }
  });
}

/**
 * Rewrite <link> stylesheet hrefs
 */
function rewriteLinkTags($: cheerio.CheerioAPI, assetMap: AssetMap, assetsPrefix: string): void {
  $('link[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;

    const localPath = findInAssetMap(href, assetMap);
    if (localPath) {
      $(el).attr('href', `${assetsPrefix}${localPath}`);
    }
  });
}

/**
 * Rewrite <script> src attributes
 */
function rewriteScriptTags($: cheerio.CheerioAPI, assetMap: AssetMap, assetsPrefix: string): void {
  $('script[src]').each((_, el) => {
    const src = $(el).attr('src');
    if (!src) return;

    const localPath = findInAssetMap(src, assetMap);
    if (localPath) {
      $(el).attr('src', `${assetsPrefix}${localPath}`);
    }
  });
}

/**
 * Look up a URL in the asset map (handles both exact match and normalized variants)
 */
function findInAssetMap(url: string, assetMap: AssetMap): string | undefined {
  // Direct match
  if (assetMap.has(url)) {
    return assetMap.get(url);
  }

  // Try with https: prefix for protocol-relative URLs
  if (url.startsWith('//')) {
    const withHttps = 'https:' + url;
    if (assetMap.has(withHttps)) {
      return assetMap.get(withHttps);
    }
  }

  // Try stripping query params
  try {
    const parsed = new URL(url, 'https://placeholder.com');
    const withoutQuery = parsed.origin + parsed.pathname;
    if (assetMap.has(withoutQuery)) {
      return assetMap.get(withoutQuery);
    }
  } catch {
    // Invalid URL
  }

  return undefined;
}
