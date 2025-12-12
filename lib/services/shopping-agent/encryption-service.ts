import crypto from 'crypto';

/**
 * Encryption Service for Shopping Agent Credentials
 *
 * Uses AES-256-GCM for encrypting sensitive data like:
 * - Payment card details
 * - Site login credentials
 * - Session cookies
 *
 * Security considerations:
 * - Encryption key should be stored in environment variables or AWS KMS
 * - Each encrypted value includes a unique IV
 * - Authentication tag prevents tampering
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits

// Get encryption key from environment
function getEncryptionKey(keyId?: string): Buffer {
  // In production, this could fetch from AWS KMS based on keyId
  // For now, use environment variable
  const keyEnvVar = keyId ? `ENCRYPTION_KEY_${keyId}` : 'SHOPPING_AGENT_ENCRYPTION_KEY';
  const key = process.env[keyEnvVar] || process.env.SHOPPING_AGENT_ENCRYPTION_KEY;

  if (!key) {
    throw new Error(`Encryption key not found. Set ${keyEnvVar} environment variable.`);
  }

  // If key is base64 encoded
  if (key.length === 44) {
    return Buffer.from(key, 'base64');
  }

  // If key is hex encoded
  if (key.length === 64) {
    return Buffer.from(key, 'hex');
  }

  // If key is raw string, derive a key using SHA-256
  return crypto.createHash('sha256').update(key).digest();
}

export interface EncryptedData {
  ciphertext: string; // Base64 encoded
  iv: string; // Base64 encoded
  authTag: string; // Base64 encoded
  keyId: string;
  version: number;
}

/**
 * Encrypt a string value
 */
export function encrypt(plaintext: string, keyId: string = 'default'): EncryptedData {
  const key = getEncryptionKey(keyId);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
  ciphertext += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  return {
    ciphertext,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    keyId,
    version: 1,
  };
}

/**
 * Decrypt an encrypted value
 */
export function decrypt(encrypted: EncryptedData): string {
  const key = getEncryptionKey(encrypted.keyId);
  const iv = Buffer.from(encrypted.iv, 'base64');
  const authTag = Buffer.from(encrypted.authTag, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let plaintext = decipher.update(encrypted.ciphertext, 'base64', 'utf8');
  plaintext += decipher.final('utf8');

  return plaintext;
}

/**
 * Encrypt to a single string (for database storage)
 * Format: version:keyId:iv:authTag:ciphertext
 */
export function encryptToString(plaintext: string, keyId: string = 'default'): string {
  const encrypted = encrypt(plaintext, keyId);
  return `${encrypted.version}:${encrypted.keyId}:${encrypted.iv}:${encrypted.authTag}:${encrypted.ciphertext}`;
}

/**
 * Decrypt from a single string
 */
export function decryptFromString(encryptedString: string): string {
  const parts = encryptedString.split(':');
  if (parts.length !== 5) {
    throw new Error('Invalid encrypted string format');
  }

  const [versionStr, keyId, iv, authTag, ciphertext] = parts;
  const version = parseInt(versionStr, 10);

  return decrypt({
    ciphertext,
    iv,
    authTag,
    keyId,
    version,
  });
}

// ============================================================================
// Payment Card Encryption
// ============================================================================

export interface PaymentCard {
  cardNumber: string;
  expiry: string; // MM/YY
  cvv: string;
  cardholderName?: string;
}

export interface EncryptedPaymentCard {
  encryptedCardNumber: string;
  encryptedExpiry: string;
  encryptedCvv: string;
  cardLastFour: string;
  cardBrand: string;
  keyId: string;
  version: number;
}

/**
 * Detect card brand from number
 */
function detectCardBrand(cardNumber: string): string {
  const cleanNumber = cardNumber.replace(/\D/g, '');

  if (/^4/.test(cleanNumber)) return 'visa';
  if (/^5[1-5]/.test(cleanNumber)) return 'mastercard';
  if (/^3[47]/.test(cleanNumber)) return 'amex';
  if (/^6(?:011|5)/.test(cleanNumber)) return 'discover';
  if (/^35(?:2[89]|[3-8])/.test(cleanNumber)) return 'jcb';

  return 'unknown';
}

/**
 * Encrypt a payment card
 */
export function encryptPaymentCard(card: PaymentCard, keyId: string = 'default'): EncryptedPaymentCard {
  const cleanNumber = card.cardNumber.replace(/\D/g, '');

  return {
    encryptedCardNumber: encryptToString(cleanNumber, keyId),
    encryptedExpiry: encryptToString(card.expiry, keyId),
    encryptedCvv: encryptToString(card.cvv, keyId),
    cardLastFour: cleanNumber.slice(-4),
    cardBrand: detectCardBrand(cleanNumber),
    keyId,
    version: 1,
  };
}

/**
 * Decrypt a payment card
 */
export function decryptPaymentCard(encrypted: EncryptedPaymentCard): PaymentCard {
  return {
    cardNumber: decryptFromString(encrypted.encryptedCardNumber),
    expiry: decryptFromString(encrypted.encryptedExpiry),
    cvv: decryptFromString(encrypted.encryptedCvv),
  };
}

// ============================================================================
// Site Credentials Encryption
// ============================================================================

export interface SiteCredentials {
  email: string;
  password: string;
  totpSecret?: string;
  backupCodes?: string[];
}

export interface EncryptedSiteCredentials {
  encryptedEmail: string;
  encryptedPassword: string;
  totpSecretEncrypted?: string;
  backupCodesEncrypted?: string;
  keyId: string;
  version: number;
}

/**
 * Encrypt site credentials
 */
export function encryptSiteCredentials(creds: SiteCredentials, keyId: string = 'default'): EncryptedSiteCredentials {
  const encrypted: EncryptedSiteCredentials = {
    encryptedEmail: encryptToString(creds.email, keyId),
    encryptedPassword: encryptToString(creds.password, keyId),
    keyId,
    version: 1,
  };

  if (creds.totpSecret) {
    encrypted.totpSecretEncrypted = encryptToString(creds.totpSecret, keyId);
  }

  if (creds.backupCodes && creds.backupCodes.length > 0) {
    encrypted.backupCodesEncrypted = encryptToString(JSON.stringify(creds.backupCodes), keyId);
  }

  return encrypted;
}

/**
 * Decrypt site credentials
 */
export function decryptSiteCredentials(encrypted: EncryptedSiteCredentials): SiteCredentials {
  const creds: SiteCredentials = {
    email: decryptFromString(encrypted.encryptedEmail),
    password: decryptFromString(encrypted.encryptedPassword),
  };

  if (encrypted.totpSecretEncrypted) {
    creds.totpSecret = decryptFromString(encrypted.totpSecretEncrypted);
  }

  if (encrypted.backupCodesEncrypted) {
    creds.backupCodes = JSON.parse(decryptFromString(encrypted.backupCodesEncrypted));
  }

  return creds;
}

// ============================================================================
// Session Cookie Encryption
// ============================================================================

/**
 * Encrypt session cookies (JSON stringified)
 */
export function encryptCookies(cookies: object, keyId: string = 'default'): string {
  return encryptToString(JSON.stringify(cookies), keyId);
}

/**
 * Decrypt session cookies
 */
export function decryptCookies(encryptedCookies: string): object {
  return JSON.parse(decryptFromString(encryptedCookies));
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a new encryption key (for setup)
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('base64');
}

/**
 * Validate that an encryption key is set
 */
export function validateEncryptionSetup(): { valid: boolean; error?: string } {
  try {
    getEncryptionKey('default');
    return { valid: true };
  } catch (error: any) {
    return { valid: false, error: error.message };
  }
}

/**
 * Mask a card number for display (show last 4)
 */
export function maskCardNumber(lastFour: string, brand: string): string {
  const maskLength = brand === 'amex' ? 11 : 12;
  return '*'.repeat(maskLength) + lastFour;
}

/**
 * Mask an email for display
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}@${domain}`;
}
