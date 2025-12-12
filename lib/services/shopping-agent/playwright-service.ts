/**
 * Playwright Service
 *
 * Handles fast, predictable browser automation tasks:
 * - Product search
 * - Reading product pages
 * - Adding to cart
 * - Basic login (without CAPTCHA)
 */

import type {
  ProductSearchResult,
  ProductDetails,
  CartSummary,
  LoginResult,
  SearchOptions,
  BrowserConfig,
} from './sites/types';

// Note: Playwright will be dynamically imported when needed
// This allows the service to be used in serverless environments
// The import is wrapped to prevent webpack from bundling it

type Browser = any;
type Page = any;
type BrowserContext = any;

// Dynamic import wrapper to prevent build-time resolution
async function getPlaywright() {
  try {
    // Use eval to prevent webpack from analyzing this import
    const playwright = await (eval('import("playwright")') as Promise<any>);
    return playwright;
  } catch (error) {
    console.error('[PlaywrightService] Playwright not available:', error);
    return null;
  }
}

// Random user agents for stealth
const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Delay helper for rate limiting
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Random delay between min and max ms
function randomDelay(min: number = 1000, max: number = 3000): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return delay(ms);
}

export class PlaywrightService {
  private browser: Browser | null = null;
  private contexts: Map<string, BrowserContext> = new Map();
  private pages: Map<string, Page> = new Map();
  private config: BrowserConfig;

  constructor(config: BrowserConfig = { headless: true }) {
    this.config = {
      headless: true,
      viewport: { width: 1920, height: 1080 },
      timeout: 30000,
      ...config,
    };
  }

  /**
   * Initialize browser
   */
  private async initBrowser(): Promise<void> {
    if (this.browser) return;

    const playwright = await getPlaywright();
    if (!playwright) {
      throw new Error('Playwright not available. Install with: npm install playwright');
    }

    try {
      this.browser = await playwright.chromium.launch({
        headless: this.config.headless,
      });
    } catch (error) {
      console.error('[PlaywrightService] Failed to launch browser:', error);
      throw new Error('Playwright not available. Install with: npm install playwright');
    }
  }

  /**
   * Get or create a browser context for a site
   */
  private async getContext(site: string): Promise<BrowserContext> {
    await this.initBrowser();

    if (!this.contexts.has(site)) {
      const context = await this.browser!.newContext({
        userAgent: this.config.userAgent || getRandomUserAgent(),
        viewport: this.config.viewport,
      });

      // Add anti-detection measures
      await context.addInitScript(() => {
        // Override webdriver detection
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        });

        // Override plugins
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });

        // Override languages
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en'],
        });
      });

      this.contexts.set(site, context);
    }

    return this.contexts.get(site)!;
  }

  /**
   * Get or create a page for a site
   */
  private async getPage(site: string): Promise<Page> {
    const context = await this.getContext(site);

    if (!this.pages.has(site)) {
      const page = await context.newPage();
      page.setDefaultTimeout(this.config.timeout || 30000);
      this.pages.set(site, page);
    }

    return this.pages.get(site)!;
  }

  // ============================================================================
  // Search
  // ============================================================================

  async search(
    site: string,
    query: string,
    options?: SearchOptions
  ): Promise<ProductSearchResult[]> {
    const page = await this.getPage(site);

    switch (site) {
      case 'amazon':
        return this.searchAmazon(page, query, options);
      case 'iherb':
        return this.searchIherb(page, query, options);
      case 'healf':
        return this.searchHealf(page, query, options);
      default:
        throw new Error(`Unsupported site: ${site}`);
    }
  }

  private async searchAmazon(
    page: Page,
    query: string,
    options?: SearchOptions
  ): Promise<ProductSearchResult[]> {
    // Navigate to Amazon
    await page.goto('https://www.amazon.com', { waitUntil: 'domcontentloaded' });
    await randomDelay();

    // Search
    await page.fill('#twotabsearchtextbox', query);
    await page.click('#nav-search-submit-button');
    await page.waitForLoadState('domcontentloaded');
    await randomDelay();

    // Extract results
    const results: ProductSearchResult[] = [];
    const items = await page.$$('[data-component-type="s-search-result"]');

    const maxResults = options?.maxResults || 10;

    for (let i = 0; i < Math.min(items.length, maxResults); i++) {
      try {
        const item = items[i];

        const name = await item.$eval('h2 span', (el: any) => el.textContent?.trim() || '').catch(() => '');
        const priceText = await item.$eval('.a-price .a-offscreen', (el: any) => el.textContent || '').catch(() => '0');
        const url = await item.$eval('h2 a', (el: any) => el.href).catch(() => '');
        const imageUrl = await item.$eval('img.s-image', (el: any) => el.src).catch(() => '');
        const ratingText = await item.$eval('[data-cy="reviews-ratings-count"]', (el: any) => el.textContent || '').catch(() => '');
        const isPrime = await item.$('.s-prime').catch(() => null) !== null;

        // Parse price
        const price = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;

        // Parse rating
        const ratingMatch = ratingText.match(/([\d.]+)/);
        const rating = ratingMatch ? parseFloat(ratingMatch[1]) : undefined;

        if (name && url) {
          results.push({
            name,
            price,
            currency: 'USD',
            url,
            imageUrl,
            rating,
            inStock: true, // Assume in stock if shown in search
            prime: isPrime,
          });
        }
      } catch (error) {
        console.error('[PlaywrightService] Error parsing Amazon result:', error);
      }
    }

    return results;
  }

  private async searchIherb(
    page: Page,
    query: string,
    options?: SearchOptions
  ): Promise<ProductSearchResult[]> {
    // Navigate to iHerb
    await page.goto(`https://www.iherb.com/search?kw=${encodeURIComponent(query)}`, {
      waitUntil: 'domcontentloaded',
    });
    await randomDelay();

    const results: ProductSearchResult[] = [];
    const items = await page.$$('.product-cell-container');

    const maxResults = options?.maxResults || 10;

    for (let i = 0; i < Math.min(items.length, maxResults); i++) {
      try {
        const item = items[i];

        const name = await item.$eval('[data-ga-product-name]', (el: any) => el.getAttribute('data-ga-product-name') || '').catch(() => '');
        const priceText = await item.$eval('.price', (el: any) => el.textContent || '').catch(() => '0');
        const url = await item.$eval('a.product-link', (el: any) => el.href).catch(() => '');
        const imageUrl = await item.$eval('img', (el: any) => el.src).catch(() => '');
        const ratingText = await item.$eval('.rating', (el: any) => el.getAttribute('title') || '').catch(() => '');

        const price = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;
        const ratingMatch = ratingText.match(/([\d.]+)/);
        const rating = ratingMatch ? parseFloat(ratingMatch[1]) : undefined;

        if (name && url) {
          results.push({
            name,
            price,
            currency: 'USD',
            url,
            imageUrl,
            rating,
            inStock: true,
            freeShipping: price > 20, // iHerb free shipping over $20
          });
        }
      } catch (error) {
        console.error('[PlaywrightService] Error parsing iHerb result:', error);
      }
    }

    return results;
  }

  private async searchHealf(
    page: Page,
    query: string,
    options?: SearchOptions
  ): Promise<ProductSearchResult[]> {
    // Navigate to Healf
    await page.goto(`https://www.healf.com/search?q=${encodeURIComponent(query)}`, {
      waitUntil: 'domcontentloaded',
    });
    await randomDelay();

    const results: ProductSearchResult[] = [];
    const items = await page.$$('.product-card');

    const maxResults = options?.maxResults || 10;

    for (let i = 0; i < Math.min(items.length, maxResults); i++) {
      try {
        const item = items[i];

        const name = await item.$eval('.product-card__title', (el: any) => el.textContent?.trim() || '').catch(() => '');
        const priceText = await item.$eval('.price', (el: any) => el.textContent || '').catch(() => '0');
        const url = await item.$eval('a', (el: any) => el.href).catch(() => '');
        const imageUrl = await item.$eval('img', (el: any) => el.src).catch(() => '');

        const price = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;

        if (name && url) {
          results.push({
            name,
            price,
            currency: 'GBP', // Healf is UK-based
            url,
            imageUrl,
            inStock: true,
          });
        }
      } catch (error) {
        console.error('[PlaywrightService] Error parsing Healf result:', error);
      }
    }

    return results;
  }

  // ============================================================================
  // Product Details
  // ============================================================================

  async getProductDetails(site: string, url: string): Promise<ProductDetails> {
    const page = await this.getPage(site);

    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await randomDelay();

    switch (site) {
      case 'amazon':
        return this.getAmazonProductDetails(page, url);
      case 'iherb':
        return this.getIherbProductDetails(page, url);
      case 'healf':
        return this.getHealfProductDetails(page, url);
      default:
        throw new Error(`Unsupported site: ${site}`);
    }
  }

  private async getAmazonProductDetails(page: Page, url: string): Promise<ProductDetails> {
    const name = await page.$eval('#productTitle', (el: any) => el.textContent?.trim() || '').catch(() => '');
    const priceText = await page.$eval('.a-price .a-offscreen', (el: any) => el.textContent || '').catch(() => '0');
    const imageUrl = await page.$eval('#landingImage', (el: any) => el.src).catch(() => '');
    const description = await page.$eval('#productDescription p', (el: any) => el.textContent?.trim() || '').catch(() => '');
    const inStock = await page.$('#availability .a-color-success').catch(() => null) !== null;

    const price = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;

    return {
      name,
      price,
      currency: 'USD',
      url,
      imageUrl,
      description,
      inStock,
    };
  }

  private async getIherbProductDetails(page: Page, url: string): Promise<ProductDetails> {
    const name = await page.$eval('#name', (el: any) => el.textContent?.trim() || '').catch(() => '');
    const priceText = await page.$eval('#price', (el: any) => el.textContent || '').catch(() => '0');
    const imageUrl = await page.$eval('#iherb-product-image', (el: any) => el.src).catch(() => '');
    const description = await page.$eval('#product-summary-header', (el: any) => el.textContent?.trim() || '').catch(() => '');

    const price = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;

    return {
      name,
      price,
      currency: 'USD',
      url,
      imageUrl,
      description,
      inStock: true,
    };
  }

  private async getHealfProductDetails(page: Page, url: string): Promise<ProductDetails> {
    const name = await page.$eval('.product__title', (el: any) => el.textContent?.trim() || '').catch(() => '');
    const priceText = await page.$eval('.price', (el: any) => el.textContent || '').catch(() => '0');
    const imageUrl = await page.$eval('.product__media img', (el: any) => el.src).catch(() => '');

    const price = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;

    return {
      name,
      price,
      currency: 'GBP',
      url,
      imageUrl,
      inStock: true,
    };
  }

  // ============================================================================
  // Cart Operations
  // ============================================================================

  async addToCart(site: string, productUrl: string, quantity: number): Promise<boolean> {
    const page = await this.getPage(site);

    await page.goto(productUrl, { waitUntil: 'domcontentloaded' });
    await randomDelay();

    try {
      switch (site) {
        case 'amazon':
          // Set quantity if needed
          if (quantity > 1) {
            await page.selectOption('#quantity', String(quantity)).catch(() => {});
          }
          await page.click('#add-to-cart-button');
          await page.waitForSelector('#NATC_SMART_WAGON_CONF_MSG_SUCCESS', { timeout: 5000 }).catch(() => {});
          return true;

        case 'iherb':
          await page.click('[data-ga-event-action="Add to Cart"]');
          await randomDelay(500, 1000);
          return true;

        case 'healf':
          await page.click('[name="add"]');
          await randomDelay(500, 1000);
          return true;

        default:
          return false;
      }
    } catch (error) {
      console.error(`[PlaywrightService] Error adding to cart on ${site}:`, error);
      return false;
    }
  }

  async getCartContents(site: string): Promise<CartSummary> {
    const page = await this.getPage(site);

    // Navigate to cart
    switch (site) {
      case 'amazon':
        await page.goto('https://www.amazon.com/gp/cart/view.html', { waitUntil: 'domcontentloaded' });
        break;
      case 'iherb':
        await page.goto('https://www.iherb.com/cart', { waitUntil: 'domcontentloaded' });
        break;
      case 'healf':
        await page.goto('https://www.healf.com/cart', { waitUntil: 'domcontentloaded' });
        break;
    }

    await randomDelay();

    // This is a simplified implementation - real implementation would parse cart items
    return {
      items: [],
      subtotal: 0,
      shipping: 0,
      tax: 0,
      total: 0,
      currency: site === 'healf' ? 'GBP' : 'USD',
      itemCount: 0,
    };
  }

  // ============================================================================
  // Login
  // ============================================================================

  async login(site: string, email: string, password: string): Promise<LoginResult> {
    const page = await this.getPage(site);

    try {
      switch (site) {
        case 'amazon':
          await page.goto('https://www.amazon.com/ap/signin', { waitUntil: 'domcontentloaded' });
          await page.fill('#ap_email', email);
          await page.click('#continue');
          await randomDelay();
          await page.fill('#ap_password', password);
          await page.click('#signInSubmit');
          await randomDelay();

          // Check for CAPTCHA
          const hasCaptcha = await page.$('#auth-captcha-image').catch(() => null);
          if (hasCaptcha) {
            return { success: false, error: 'captcha detected' };
          }

          // Check for 2FA
          const has2FA = await page.$('#auth-mfa-otpcode').catch(() => null);
          if (has2FA) {
            return { success: false, requires2FA: true, twoFAMethod: 'totp' };
          }

          // Check if logged in
          const isLoggedIn = await page.$('#nav-link-accountList-nav-line-1').catch(() => null);
          return { success: isLoggedIn !== null };

        case 'iherb':
          await page.goto('https://www.iherb.com/account/login', { waitUntil: 'domcontentloaded' });
          await page.fill('#email', email);
          await page.fill('#password', password);
          await page.click('[type="submit"]');
          await randomDelay();
          return { success: true };

        default:
          return { success: false, error: 'Unsupported site' };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // ============================================================================
  // Session Management
  // ============================================================================

  async loadSession(site: string, cookiesJson: string): Promise<boolean> {
    try {
      const context = await this.getContext(site);
      const cookies = JSON.parse(cookiesJson);
      await context.addCookies(cookies);
      return true;
    } catch (error) {
      console.error('[PlaywrightService] Error loading session:', error);
      return false;
    }
  }

  async saveSession(site: string): Promise<string> {
    try {
      const context = await this.getContext(site);
      const cookies = await context.cookies();
      return JSON.stringify(cookies);
    } catch (error) {
      console.error('[PlaywrightService] Error saving session:', error);
      return '[]';
    }
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  async close(): Promise<void> {
    for (const context of this.contexts.values()) {
      await context.close().catch(() => {});
    }
    this.contexts.clear();
    this.pages.clear();

    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }
}
