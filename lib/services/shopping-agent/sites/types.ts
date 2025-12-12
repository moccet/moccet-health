/**
 * Types for Shopping Agent Site Adapters
 */

export interface ProductSearchResult {
  name: string;
  brand?: string;
  price: number;
  currency: string;
  url: string;
  imageUrl?: string;
  rating?: number;
  reviewCount?: number;
  inStock: boolean;
  prime?: boolean; // Amazon Prime eligible
  freeShipping?: boolean;
  dosage?: string;
  quantity?: string; // "60 capsules", "90 tablets", etc.
  pricePerUnit?: number; // Price per capsule/tablet
  matchScore?: number; // How well it matches the search query (0-1)
}

export interface ProductDetails extends ProductSearchResult {
  description?: string;
  ingredients?: string[];
  directions?: string;
  warnings?: string;
  manufacturer?: string;
  asin?: string; // Amazon Standard Identification Number
  sku?: string;
  variants?: ProductVariant[];
  relatedProducts?: ProductSearchResult[];
}

export interface ProductVariant {
  name: string;
  price: number;
  inStock: boolean;
  url?: string;
}

export interface CartItem {
  productUrl: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  imageUrl?: string;
}

export interface CartSummary {
  items: CartItem[];
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  currency: string;
  itemCount: number;
}

export interface CheckoutParams {
  site: string;
  email: string;
  shippingAddress: ShippingAddress;
  paymentCard: PaymentCardInfo;
  items: CartItem[];
  expectedTotal: number;
}

export interface ShippingAddress {
  fullName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
}

export interface PaymentCardInfo {
  cardNumber: string;
  expiry: string;
  cvv: string;
  cardholderName?: string;
}

export interface CheckoutResult {
  success: boolean;
  orderNumber?: string;
  orderUrl?: string;
  total?: number;
  estimatedDelivery?: string;
  error?: string;
  errorType?: 'captcha' | 'login_failed' | '2fa_required' | 'payment_failed' | 'out_of_stock' | 'price_changed' | 'unknown';
  screenshotUrl?: string;
}

export interface LoginResult {
  success: boolean;
  error?: string;
  requires2FA?: boolean;
  twoFAMethod?: 'sms' | 'email' | 'totp' | 'app';
  sessionCookies?: string;
}

export interface SiteAdapter {
  siteName: string;
  baseUrl: string;

  // Search
  search(query: string, options?: SearchOptions): Promise<ProductSearchResult[]>;

  // Product details
  getProductDetails(url: string): Promise<ProductDetails>;

  // Cart operations
  addToCart(productUrl: string, quantity: number): Promise<boolean>;
  getCartContents(): Promise<CartSummary>;
  clearCart(): Promise<boolean>;

  // Session management
  loadSession(cookies: string): Promise<boolean>;
  saveSession(): Promise<string>;

  // Login (for authenticated operations)
  login(email: string, password: string): Promise<LoginResult>;
  handleTwoFA(code: string, method: string): Promise<LoginResult>;

  // Checkout (complex flow - may use Computer Use)
  initiateCheckout(): Promise<void>;
}

export interface SearchOptions {
  maxResults?: number;
  sortBy?: 'relevance' | 'price_low' | 'price_high' | 'rating' | 'reviews';
  priceMin?: number;
  priceMax?: number;
  inStockOnly?: boolean;
  primeOnly?: boolean; // Amazon
}

export interface BrowserConfig {
  headless: boolean;
  proxy?: string;
  userAgent?: string;
  viewport?: { width: number; height: number };
  timeout?: number;
}

export interface ExecutionStep {
  timestamp: string;
  action: string;
  result: 'success' | 'failed' | 'pending';
  details?: string;
  screenshotUrl?: string;
  duration?: number;
}
