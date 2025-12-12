/**
 * Shopping Agent Services
 *
 * An autonomous shopping agent that can browse e-commerce sites
 * and complete purchases on behalf of users.
 */

// Core services
export { BrowserController } from './browser-controller';
export { PlaywrightService } from './playwright-service';
export { ComputerUseService } from './computer-use-service';

// Encryption
export {
  encrypt,
  decrypt,
  encryptToString,
  decryptFromString,
  encryptPaymentCard,
  decryptPaymentCard,
  encryptSiteCredentials,
  decryptSiteCredentials,
  encryptCookies,
  decryptCookies,
  generateEncryptionKey,
  validateEncryptionSetup,
  maskCardNumber,
  maskEmail,
} from './encryption-service';

// Types
export type {
  ProductSearchResult,
  ProductDetails,
  ProductVariant,
  CartItem,
  CartSummary,
  CheckoutParams,
  CheckoutResult,
  LoginResult,
  ShippingAddress,
  PaymentCardInfo,
  SearchOptions,
  BrowserConfig,
  ExecutionStep,
  SiteAdapter,
} from './sites/types';
