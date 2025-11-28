/**
 * Stripe Configuration and Utilities
 */

import Stripe from 'stripe';

// Server-side Stripe instance
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
  typescript: true,
});

// Stripe configuration
export const stripeConfig = {
  publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  currency: 'usd' as const,
};

// Shipping configuration
export const shippingConfig = {
  flatRate: parseFloat(process.env.SHIPPING_FLAT_RATE || '8.99'),
  freeShippingThreshold: parseFloat(process.env.FREE_SHIPPING_THRESHOLD || '75.00'),
};

// Tax configuration
export const taxConfig = {
  rate: parseFloat(process.env.TAX_RATE || '0.08'), // 8% default
};

/**
 * Calculates shipping cost based on order subtotal
 */
export function calculateShipping(subtotal: number): number {
  if (subtotal >= shippingConfig.freeShippingThreshold) {
    return 0; // Free shipping
  }
  return shippingConfig.flatRate;
}

/**
 * Calculates tax amount based on subtotal
 */
export function calculateTax(subtotal: number): number {
  return Math.round(subtotal * taxConfig.rate * 100) / 100;
}

/**
 * Calculates order total
 */
export function calculateOrderTotal(subtotal: number): {
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
} {
  const shipping = calculateShipping(subtotal);
  const taxableAmount = subtotal + shipping;
  const tax = calculateTax(taxableAmount);
  const total = subtotal + shipping + tax;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    shipping: Math.round(shipping * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

/**
 * Formats amount for Stripe (converts dollars to cents)
 */
export function formatAmountForStripe(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Formats amount from Stripe (converts cents to dollars)
 */
export function formatAmountFromStripe(amount: number): number {
  return amount / 100;
}

/**
 * Creates a Stripe customer
 */
export async function createStripeCustomer(
  email: string,
  name?: string
): Promise<Stripe.Customer> {
  const customer = await stripe.customers.create({
    email,
    name,
    metadata: {
      source: 'moccet_supplement_store',
    },
  });

  return customer;
}

/**
 * Gets or creates a Stripe customer
 */
export async function getOrCreateStripeCustomer(
  email: string,
  name?: string
): Promise<Stripe.Customer> {
  // Check if customer already exists
  const existingCustomers = await stripe.customers.list({
    email,
    limit: 1,
  });

  if (existingCustomers.data.length > 0) {
    return existingCustomers.data[0];
  }

  // Create new customer
  return createStripeCustomer(email, name);
}

/**
 * Creates a payment intent for checkout
 */
export async function createPaymentIntent(
  amount: number,
  customerEmail: string,
  metadata?: Record<string, string>
): Promise<Stripe.PaymentIntent> {
  const customer = await getOrCreateStripeCustomer(customerEmail);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: formatAmountForStripe(amount),
    currency: stripeConfig.currency,
    customer: customer.id,
    automatic_payment_methods: {
      enabled: true,
    },
    metadata: {
      customer_email: customerEmail,
      ...metadata,
    },
  });

  return paymentIntent;
}

/**
 * Retrieves a payment intent
 */
export async function retrievePaymentIntent(
  paymentIntentId: string
): Promise<Stripe.PaymentIntent> {
  return stripe.paymentIntents.retrieve(paymentIntentId);
}

/**
 * Confirms a payment intent
 */
export async function confirmPaymentIntent(
  paymentIntentId: string
): Promise<Stripe.PaymentIntent> {
  return stripe.paymentIntents.confirm(paymentIntentId);
}

/**
 * Creates a refund
 */
export async function createRefund(
  paymentIntentId: string,
  amount?: number,
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer'
): Promise<Stripe.Refund> {
  return stripe.refunds.create({
    payment_intent: paymentIntentId,
    amount: amount ? formatAmountForStripe(amount) : undefined,
    reason,
  });
}

/**
 * Verifies a webhook signature
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    stripeConfig.webhookSecret
  );
}
