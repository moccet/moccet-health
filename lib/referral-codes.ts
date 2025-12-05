/**
 * Referral Code Management
 * Simple in-memory tracking for referral code usage
 */

// In-memory storage for referral code usage
// In production, this should be stored in a database
const referralCodeUsage = new Map<string, number>();

interface ReferralCode {
  code: string;
  maxUses: number;
  description?: string;
}

// Define your referral codes here
const REFERRAL_CODES: ReferralCode[] = [
  {
    code: 'EARLYACCESS',
    maxUses: 100,
    description: 'Early access referral code - 100 uses'
  },
  {
    code: 'LAUNCH100',
    maxUses: 100,
    description: 'Launch referral code - 100 uses'
  },
];

/**
 * Validate a referral code
 * Returns true if code is valid and has uses remaining
 */
export function validateReferralCode(code: string): { valid: boolean; message?: string } {
  if (!code || typeof code !== 'string') {
    return { valid: false, message: 'Invalid code format' };
  }

  const normalizedCode = code.toUpperCase().trim();

  // Find the referral code configuration
  const referralConfig = REFERRAL_CODES.find(rc => rc.code === normalizedCode);

  if (!referralConfig) {
    return { valid: false, message: 'Invalid referral code' };
  }

  // Check current usage
  const currentUses = referralCodeUsage.get(normalizedCode) || 0;

  if (currentUses >= referralConfig.maxUses) {
    return { valid: false, message: 'Referral code has reached maximum uses' };
  }

  return { valid: true };
}

/**
 * Increment the usage count for a referral code
 * Call this after successful payment/plan generation
 */
export function incrementReferralCodeUsage(code: string): void {
  const normalizedCode = code.toUpperCase().trim();
  const currentUses = referralCodeUsage.get(normalizedCode) || 0;
  referralCodeUsage.set(normalizedCode, currentUses + 1);

  console.log(`[Referral Code] ${normalizedCode} used: ${currentUses + 1} times`);
}

/**
 * Get current usage stats for a referral code
 */
export function getReferralCodeStats(code: string): { uses: number; maxUses: number; remaining: number } | null {
  const normalizedCode = code.toUpperCase().trim();
  const referralConfig = REFERRAL_CODES.find(rc => rc.code === normalizedCode);

  if (!referralConfig) {
    return null;
  }

  const uses = referralCodeUsage.get(normalizedCode) || 0;

  return {
    uses,
    maxUses: referralConfig.maxUses,
    remaining: Math.max(0, referralConfig.maxUses - uses)
  };
}

/**
 * Get all referral codes (admin only)
 */
export function getAllReferralCodes(): ReferralCode[] {
  return REFERRAL_CODES;
}
