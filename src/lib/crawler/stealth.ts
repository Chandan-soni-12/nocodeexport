// ============================================================
// stealth.ts — Custom anti-detection for Playwright
// Replaces deprecated playwright-extra + stealth plugin
// ============================================================

import { chromium, Browser, BrowserContext, Page } from 'playwright';

/** Realistic Chrome user agent */
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

/** Browser launch arguments for stealth */
const STEALTH_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--disable-features=IsolateOrigins,site-per-process',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-dev-shm-usage',
  '--disable-background-networking',
  '--disable-default-apps',
  '--disable-sync',
  '--disable-translate',
  '--metrics-recording-only',
  '--no-sandbox',
];

/** JavaScript to inject before any page script runs */
const STEALTH_INIT_SCRIPT = `
  // Remove webdriver flag
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

  // Override permissions query for notifications
  const originalQuery = window.Notification?.permission
    ? window.Notification.permission
    : undefined;
  if (window.Notification) {
    window.Notification.requestPermission = () => Promise.resolve('default');
  }

  // Spoof plugins (Chrome typically has 3-5)
  Object.defineProperty(navigator, 'plugins', {
    get: () => {
      return [
        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
        { name: 'Native Client', filename: 'internal-nacl-plugin' },
      ];
    },
  });

  // Spoof languages
  Object.defineProperty(navigator, 'languages', {
    get: () => ['en-US', 'en'],
  });

  // Prevent detection via Chrome DevTools Protocol
  window.chrome = {
    runtime: {},
    loadTimes: function () {},
    csi: function () {},
    app: {},
  };

  // Fix iframe contentWindow detection
  const originalContentWindow = Object.getOwnPropertyDescriptor(
    HTMLIFrameElement.prototype,
    'contentWindow'
  );
  if (originalContentWindow) {
    Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
      get: function () {
        return originalContentWindow.get?.call(this);
      },
    });
  }
`;

/**
 * Launch a stealth Chromium browser with anti-detection measures
 */
export async function launchStealthBrowser(): Promise<Browser> {
  const browser = await chromium.launch({
    headless: true,
    args: STEALTH_ARGS,
  });
  return browser;
}

/**
 * Create a stealth browser context with realistic fingerprint
 */
export async function createStealthContext(browser: Browser): Promise<BrowserContext> {
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
    deviceScaleFactor: 1,
    hasTouch: false,
    javaScriptEnabled: true,
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
      'sec-ch-ua': '"Chromium";v="125", "Not.A/Brand";v="24"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
    },
  });

  // Inject stealth script before any page script runs
  await context.addInitScript(STEALTH_INIT_SCRIPT);

  return context;
}

/**
 * Create a new stealth page within a context
 */
export async function createStealthPage(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  return page;
}

/**
 * Random delay to simulate human-like browsing
 */
export function randomDelay(min = 100, max = 500): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, delay));
}
