/**
 * Browser Controller
 *
 * Routes between Playwright (fast, simple operations) and
 * Claude Computer Use (complex, dynamic operations)
 */

import type {
  ProductSearchResult,
  ProductDetails,
  CartSummary,
  CheckoutParams,
  CheckoutResult,
  LoginResult,
  SearchOptions,
  BrowserConfig,
  ExecutionStep,
} from './sites/types';

// Task complexity classification
type TaskComplexity = 'simple' | 'medium' | 'complex';

interface TaskClassification {
  task: string;
  complexity: TaskComplexity;
  useComputerUse: boolean;
  reason: string;
}

// Classify tasks by complexity
const TASK_CLASSIFICATIONS: Record<string, TaskClassification> = {
  // Simple tasks - use Playwright
  search: {
    task: 'search',
    complexity: 'simple',
    useComputerUse: false,
    reason: 'Searching is predictable with known selectors',
  },
  getProductDetails: {
    task: 'getProductDetails',
    complexity: 'simple',
    useComputerUse: false,
    reason: 'Product pages have consistent structure',
  },
  addToCart: {
    task: 'addToCart',
    complexity: 'simple',
    useComputerUse: false,
    reason: 'Add to cart buttons are predictable',
  },
  getCart: {
    task: 'getCart',
    complexity: 'simple',
    useComputerUse: false,
    reason: 'Cart pages have consistent structure',
  },

  // Medium tasks - try Playwright, fallback to Computer Use
  login: {
    task: 'login',
    complexity: 'medium',
    useComputerUse: false, // Start with Playwright
    reason: 'Login forms are usually predictable, but may have CAPTCHAs',
  },

  // Complex tasks - use Computer Use
  checkout: {
    task: 'checkout',
    complexity: 'complex',
    useComputerUse: true,
    reason: 'Checkout flows are dynamic with multiple steps',
  },
  createAccount: {
    task: 'createAccount',
    complexity: 'complex',
    useComputerUse: true,
    reason: 'Account creation has dynamic forms and verification',
  },
  handle2FA: {
    task: 'handle2FA',
    complexity: 'complex',
    useComputerUse: true,
    reason: '2FA flows vary widely and may involve visual verification',
  },
  solveCaptcha: {
    task: 'solveCaptcha',
    complexity: 'complex',
    useComputerUse: true,
    reason: 'CAPTCHAs require visual understanding',
  },
};

export class BrowserController {
  private playwrightService: any; // Will be lazy loaded
  private computerUseService: any; // Will be lazy loaded
  private executionLog: ExecutionStep[] = [];

  constructor(private config: BrowserConfig = { headless: true }) {}

  /**
   * Determine which service to use for a task
   */
  private shouldUseComputerUse(task: string, forceComputerUse: boolean = false): boolean {
    if (forceComputerUse) return true;

    const classification = TASK_CLASSIFICATIONS[task];
    if (!classification) {
      // Unknown task - use Computer Use for safety
      return true;
    }

    return classification.useComputerUse;
  }

  /**
   * Log an execution step
   */
  private logStep(action: string, result: 'success' | 'failed' | 'pending', details?: string): void {
    this.executionLog.push({
      timestamp: new Date().toISOString(),
      action,
      result,
      details,
    });
  }

  /**
   * Get the execution log
   */
  getExecutionLog(): ExecutionStep[] {
    return [...this.executionLog];
  }

  /**
   * Clear the execution log
   */
  clearLog(): void {
    this.executionLog = [];
  }

  // ============================================================================
  // Search Operations (Playwright)
  // ============================================================================

  async searchProducts(
    site: string,
    query: string,
    options?: SearchOptions
  ): Promise<ProductSearchResult[]> {
    this.logStep(`Search ${site} for "${query}"`, 'pending');

    try {
      // Lazy load Playwright service
      if (!this.playwrightService) {
        const { PlaywrightService } = await import('./playwright-service');
        this.playwrightService = new PlaywrightService(this.config);
      }

      const results = await this.playwrightService.search(site, query, options);
      this.logStep(`Search ${site} for "${query}"`, 'success', `Found ${results.length} products`);
      return results;
    } catch (error: any) {
      this.logStep(`Search ${site} for "${query}"`, 'failed', error.message);
      throw error;
    }
  }

  async getProductDetails(site: string, url: string): Promise<ProductDetails> {
    this.logStep(`Get product details from ${site}`, 'pending');

    try {
      if (!this.playwrightService) {
        const { PlaywrightService } = await import('./playwright-service');
        this.playwrightService = new PlaywrightService(this.config);
      }

      const details = await this.playwrightService.getProductDetails(site, url);
      this.logStep(`Get product details from ${site}`, 'success');
      return details;
    } catch (error: any) {
      this.logStep(`Get product details from ${site}`, 'failed', error.message);
      throw error;
    }
  }

  // ============================================================================
  // Cart Operations (Playwright)
  // ============================================================================

  async addToCart(site: string, productUrl: string, quantity: number): Promise<boolean> {
    this.logStep(`Add to cart on ${site}`, 'pending');

    try {
      if (!this.playwrightService) {
        const { PlaywrightService } = await import('./playwright-service');
        this.playwrightService = new PlaywrightService(this.config);
      }

      const success = await this.playwrightService.addToCart(site, productUrl, quantity);
      this.logStep(`Add to cart on ${site}`, success ? 'success' : 'failed');
      return success;
    } catch (error: any) {
      this.logStep(`Add to cart on ${site}`, 'failed', error.message);
      throw error;
    }
  }

  async getCartContents(site: string): Promise<CartSummary> {
    this.logStep(`Get cart contents from ${site}`, 'pending');

    try {
      if (!this.playwrightService) {
        const { PlaywrightService } = await import('./playwright-service');
        this.playwrightService = new PlaywrightService(this.config);
      }

      const cart = await this.playwrightService.getCartContents(site);
      this.logStep(`Get cart contents from ${site}`, 'success', `${cart.itemCount} items`);
      return cart;
    } catch (error: any) {
      this.logStep(`Get cart contents from ${site}`, 'failed', error.message);
      throw error;
    }
  }

  // ============================================================================
  // Login Operations (Playwright with fallback)
  // ============================================================================

  async login(
    site: string,
    email: string,
    password: string,
    forceComputerUse: boolean = false
  ): Promise<LoginResult> {
    this.logStep(`Login to ${site}`, 'pending');

    const useComputerUse = this.shouldUseComputerUse('login', forceComputerUse);

    try {
      if (useComputerUse) {
        if (!this.computerUseService) {
          const { ComputerUseService } = await import('./computer-use-service');
          this.computerUseService = new ComputerUseService();
        }
        const result = await this.computerUseService.login(site, email, password);
        this.logStep(`Login to ${site}`, result.success ? 'success' : 'failed');
        return result;
      }

      // Try Playwright first
      if (!this.playwrightService) {
        const { PlaywrightService } = await import('./playwright-service');
        this.playwrightService = new PlaywrightService(this.config);
      }

      const result = await this.playwrightService.login(site, email, password);

      // If Playwright login failed due to CAPTCHA, escalate to Computer Use
      if (!result.success && result.error?.includes('captcha')) {
        this.logStep(`Login to ${site}`, 'pending', 'CAPTCHA detected, escalating to Computer Use');
        return this.login(site, email, password, true);
      }

      this.logStep(`Login to ${site}`, result.success ? 'success' : 'failed');
      return result;
    } catch (error: any) {
      this.logStep(`Login to ${site}`, 'failed', error.message);

      // Escalate to Computer Use on any error if we haven't already
      if (!useComputerUse) {
        this.logStep(`Login to ${site}`, 'pending', 'Playwright failed, escalating to Computer Use');
        return this.login(site, email, password, true);
      }

      throw error;
    }
  }

  // ============================================================================
  // Checkout Operations (Computer Use)
  // ============================================================================

  async executeCheckout(params: CheckoutParams): Promise<CheckoutResult> {
    this.logStep(`Checkout on ${params.site}`, 'pending');

    try {
      // Always use Computer Use for checkout
      if (!this.computerUseService) {
        const { ComputerUseService } = await import('./computer-use-service');
        this.computerUseService = new ComputerUseService();
      }

      const result = await this.computerUseService.executeCheckout(params);
      this.logStep(
        `Checkout on ${params.site}`,
        result.success ? 'success' : 'failed',
        result.success ? `Order: ${result.orderNumber}` : result.error
      );
      return result;
    } catch (error: any) {
      this.logStep(`Checkout on ${params.site}`, 'failed', error.message);
      throw error;
    }
  }

  async handle2FA(site: string, code: string, method: string): Promise<LoginResult> {
    this.logStep(`Handle 2FA on ${site}`, 'pending');

    try {
      if (!this.computerUseService) {
        const { ComputerUseService } = await import('./computer-use-service');
        this.computerUseService = new ComputerUseService();
      }

      const result = await this.computerUseService.handle2FA(site, code, method);
      this.logStep(`Handle 2FA on ${site}`, result.success ? 'success' : 'failed');
      return result;
    } catch (error: any) {
      this.logStep(`Handle 2FA on ${site}`, 'failed', error.message);
      throw error;
    }
  }

  // ============================================================================
  // Session Management
  // ============================================================================

  async loadSession(site: string, cookies: string): Promise<boolean> {
    try {
      if (!this.playwrightService) {
        const { PlaywrightService } = await import('./playwright-service');
        this.playwrightService = new PlaywrightService(this.config);
      }

      return await this.playwrightService.loadSession(site, cookies);
    } catch (error) {
      console.error('[BrowserController] Error loading session:', error);
      return false;
    }
  }

  async saveSession(site: string): Promise<string | null> {
    try {
      if (!this.playwrightService) {
        return null;
      }

      return await this.playwrightService.saveSession(site);
    } catch (error) {
      console.error('[BrowserController] Error saving session:', error);
      return null;
    }
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  async close(): Promise<void> {
    if (this.playwrightService) {
      await this.playwrightService.close();
    }
    if (this.computerUseService) {
      await this.computerUseService.close();
    }
  }
}
