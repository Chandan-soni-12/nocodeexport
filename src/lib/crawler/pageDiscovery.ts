// ============================================================
// pageDiscovery.ts — Find all pages on a Framer site
// Uses sitemap.xml + link crawling for comprehensive discovery
// ============================================================

import axios from 'axios';
import * as cheerio from 'cheerio';
import type { DiscoveredPage } from '@/types';

/**
 * Discover all pages on a Framer site
 * Strategy: 1) Parse sitemap.xml  2) Crawl homepage links  3) Merge & deduplicate
 */
export async function discoverPages(
  baseUrl: string,
  maxPages: number = 100
): Promise<DiscoveredPage[]> {
  const origin = new URL(baseUrl).origin;
  const discovered = new Map<string, DiscoveredPage>();

  // Always include the homepage
  addPage(discovered, origin + '/', 0, origin);

  // Strategy 1: Try sitemap.xml (Framer auto-generates this)
  try {
    const sitemapUrls = await fetchSitemap(origin);
    for (const url of sitemapUrls) {
      addPage(discovered, url, 1, origin);
    }
  } catch {
    // Sitemap not available — that's fine, we'll rely on link crawling
  }

  // Strategy 2: Crawl homepage for links
  try {
    const homepageLinks = await extractLinksFromPage(origin + '/');
    for (const url of homepageLinks) {
      addPage(discovered, url, 1, origin);
    }
  } catch {
    // Homepage crawl failed — we at least have sitemap results
  }

  // Convert to array, limit to maxPages, sort by depth then alphabetically
  const pages = Array.from(discovered.values())
    .slice(0, maxPages)
    .sort((a, b) => {
      if (a.depth !== b.depth) return a.depth - b.depth;
      return a.slug.localeCompare(b.slug);
    });

  return pages;
}

/**
 * Fetch and parse sitemap.xml
 */
async function fetchSitemap(origin: string): Promise<string[]> {
  const urls: string[] = [];
  
  // Try standard sitemap locations
  const sitemapUrls = [
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
  ];

  for (const sitemapUrl of sitemapUrls) {
    try {
      const response = await axios.get(sitemapUrl, {
        timeout: 10000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ExportBot/1.0)' },
      });

      if (response.status === 200 && response.data) {
        const $ = cheerio.load(response.data, { xmlMode: true });
        
        // Handle sitemap index (contains links to other sitemaps)
        const sitemapLocs = $('sitemap loc');
        if (sitemapLocs.length > 0) {
          for (const el of sitemapLocs.toArray()) {
            const childSitemapUrl = $(el).text().trim();
            try {
              const childUrls = await fetchSingleSitemap(childSitemapUrl);
              urls.push(...childUrls);
            } catch {
              // Skip failed child sitemaps
            }
          }
        }

        // Handle regular sitemap
        const locs = $('url loc');
        for (const el of locs.toArray()) {
          const url = $(el).text().trim();
          if (url) urls.push(url);
        }

        if (urls.length > 0) break; // Found a working sitemap
      }
    } catch {
      continue;
    }
  }

  return urls;
}

/**
 * Fetch a single sitemap file
 */
async function fetchSingleSitemap(url: string): Promise<string[]> {
  const response = await axios.get(url, {
    timeout: 10000,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ExportBot/1.0)' },
  });

  const urls: string[] = [];
  const $ = cheerio.load(response.data, { xmlMode: true });
  
  $('url loc').each((_, el) => {
    const loc = $(el).text().trim();
    if (loc) urls.push(loc);
  });

  return urls;
}

/**
 * Extract all same-origin links from a page's HTML
 */
async function extractLinksFromPage(url: string): Promise<string[]> {
  const response = await axios.get(url, {
    timeout: 15000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    },
  });

  const $ = cheerio.load(response.data);
  const origin = new URL(url).origin;
  const links: string[] = [];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;

    try {
      const resolved = new URL(href, url);
      // Same-origin only, no anchors, no query-only
      if (resolved.origin === origin && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
        links.push(resolved.origin + resolved.pathname);
      }
    } catch {
      // Invalid URL — skip
    }
  });

  return links;
}

/**
 * Add a page to the discovered map with deduplication
 */
function addPage(
  map: Map<string, DiscoveredPage>,
  url: string,
  depth: number,
  origin: string
): void {
  // Normalize: strip trailing slash (except root), lowercase path
  const normalized = normalizeUrl(url);
  if (map.has(normalized)) return;

  const slug = urlToSlug(normalized, origin);
  map.set(normalized, { url: normalized, depth, slug });
}

/**
 * Normalize a URL for deduplication
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove trailing slash (except root "/")
    let pathname = parsed.pathname;
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    return parsed.origin + pathname;
  } catch {
    return url;
  }
}

/**
 * Convert a URL to a filesystem-safe slug
 * e.g., https://example.com/about/team → about/team
 * Root → index
 */
function urlToSlug(url: string, origin: string): string {
  const pathname = new URL(url).pathname;
  
  if (pathname === '/' || pathname === '') {
    return 'index';
  }

  // Remove leading slash, replace remaining slashes
  let slug = pathname.replace(/^\//, '').replace(/\/$/, '');
  
  // Replace slashes with hyphens for flat file structure
  // Keep nested structure for subpages
  slug = slug.replace(/\//g, '-');
  
  // Make filesystem safe
  slug = slug.replace(/[^a-zA-Z0-9\-_]/g, '-');
  
  return slug || 'index';
}

export { normalizeUrl, urlToSlug };
