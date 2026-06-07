// ============================================================
// cssProcessor.ts — Extract and rewrite CSS asset references
// Downloads fonts/images referenced in CSS, rewrites url() paths
// ============================================================

import * as fs from 'fs/promises';
import * as path from 'path';
import valueParser from 'postcss-value-parser';
import type { AssetMap } from '@/types';
import { AssetCapture } from './assetCapture';

/** Regex to find url() patterns in CSS */
const URL_REGEX = /url\(\s*['"]?([^'")\s]+)['"]?\s*\)/g;

/**
 * Process all CSS files — download referenced assets and rewrite URLs
 */
export async function processCssFiles(
  outputDir: string,
  assetCapture: AssetCapture,
  assetMap: AssetMap
): Promise<void> {
  const assetsDir = path.join(outputDir, 'assets');
  
  try {
    const files = await findCssFiles(assetsDir);
    
    for (const cssFile of files) {
      try {
        await processSingleCssFile(cssFile, outputDir, assetCapture, assetMap);
      } catch {
        // Skip failed CSS files — don't break the whole export
      }
    }
  } catch {
    // No CSS files found — that's fine
  }
}

/**
 * Find all CSS files recursively in a directory
 */
async function findCssFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await findCssFiles(fullPath)));
      } else if (entry.name.endsWith('.css')) {
        files.push(fullPath);
      }
    }
  } catch {
    // Directory doesn't exist
  }

  return files;
}

/**
 * Process a single CSS file — find url() references, download assets, rewrite paths
 */
async function processSingleCssFile(
  cssFilePath: string,
  outputDir: string,
  assetCapture: AssetCapture,
  assetMap: AssetMap
): Promise<void> {
  let cssContent = await fs.readFile(cssFilePath, 'utf-8');
  let modified = false;

  // Find all url() patterns
  const urlMatches = [...cssContent.matchAll(URL_REGEX)];

  for (const match of urlMatches) {
    const originalUrl = match[1];

    // Skip data: URIs and already-relative paths that exist
    if (originalUrl.startsWith('data:') || originalUrl.startsWith('#')) {
      continue;
    }

    // Check if we already have this asset
    let localPath: string | null | undefined = assetMap.get(originalUrl);

    if (!localPath) {
      // Try to resolve relative URL against common Framer CDN origins
      const resolvedUrl = resolveUrl(originalUrl);
      localPath = assetMap.get(resolvedUrl);

      if (!localPath && resolvedUrl.startsWith('http')) {
        // Download the missing asset
        localPath = await assetCapture.downloadExternalAsset(resolvedUrl);
      }
    }

    if (localPath) {
      // Calculate relative path from CSS file to asset
      const cssDir = path.dirname(cssFilePath);
      const assetFullPath = path.join(outputDir, 'assets', localPath);
      let relativePath = path.relative(cssDir, assetFullPath).replace(/\\/g, '/');
      
      // Ensure it starts with ./
      if (!relativePath.startsWith('.')) {
        relativePath = './' + relativePath;
      }

      cssContent = cssContent.replace(
        match[0],
        `url('${relativePath}')`
      );
      modified = true;
    }
  }

  if (modified) {
    await fs.writeFile(cssFilePath, cssContent);
  }
}

/**
 * Resolve a potentially relative URL to an absolute one
 */
function resolveUrl(url: string): string {
  // If it's already absolute, return as-is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // If it starts with //, add https:
  if (url.startsWith('//')) {
    return 'https:' + url;
  }

  return url;
}

/**
 * Extract all font URLs from CSS content (for targeted font downloading)
 */
export function extractFontUrls(cssContent: string): string[] {
  const fonts: string[] = [];
  
  try {
    const parsed = valueParser(cssContent);
    
    parsed.walk((node) => {
      if (node.type === 'function' && node.value === 'url') {
        const urlNode = node.nodes?.[0];
        if (urlNode && urlNode.value) {
          const url = urlNode.value.replace(/['"]/g, '');
          if (isFontUrl(url)) {
            fonts.push(url);
          }
        }
      }
    });
  } catch {
    // Fallback: regex extraction
    const matches = cssContent.matchAll(URL_REGEX);
    for (const match of matches) {
      if (isFontUrl(match[1])) {
        fonts.push(match[1]);
      }
    }
  }

  return fonts;
}

/**
 * Check if a URL likely points to a font file
 */
function isFontUrl(url: string): boolean {
  const fontExtensions = ['.woff2', '.woff', '.ttf', '.otf', '.eot'];
  const lower = url.toLowerCase();
  return fontExtensions.some((ext) => lower.includes(ext));
}
