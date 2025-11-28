'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface CartItem {
  name: string;
  brand: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

interface OrderSummary {
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  items: CartItem[];
}

// Checkout Form Component
function CheckoutForm({ email, planCode }: { email: string; planCode?: string }) {
  const router = useRouter();
  const stripe = useStripe();
  const elements = useElements();

  const [orderSummary, setOrderSummary] = useState<OrderSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);

  // Shipping form state
  const [shippingAddress, setShippingAddress] = useState({
    fullName: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    stateProvince: '',
    postalCode: '',
    country: 'US',
    phone: '',
  });

  const [customerNotes, setCustomerNotes] = useState('');

  // Create payment intent
  useEffect(() => {
    const createPaymentIntent = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/checkout/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, planCode }),
        });

        const data = await response.json();
        if (data.success) {
          setPaymentIntentId(data.paymentIntentId);
          setOrderSummary(data.orderSummary);
        } else {
          alert(`Error: ${data.error}`);
        }
      } catch (error) {
        console.error('Error creating payment intent:', error);
        alert('Failed to initialize checkout');
      } finally {
        setLoading(false);
      }
    };

    createPaymentIntent();
  }, [email, planCode]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements || !paymentIntentId) {
      return;
    }

    // Validate shipping address
    if (!shippingAddress.fullName || !shippingAddress.addressLine1 ||
        !shippingAddress.city || !shippingAddress.stateProvince ||
        !shippingAddress.postalCode) {
      alert('Please fill in all required shipping fields');
      return;
    }

    setProcessing(true);

    try {
      // Confirm payment with Stripe
      const { error: stripeError } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      });

      if (stripeError) {
        alert(`Payment failed: ${stripeError.message}`);
        setProcessing(false);
        return;
      }

      // Payment succeeded, create order
      const response = await fetch('/api/checkout/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          paymentIntentId,
          shippingAddress,
          customerNotes,
        }),
      });

      const data = await response.json();
      if (data.success) {
        // Redirect to confirmation page
        router.push(`/order-confirmation?orderNumber=${data.order.orderNumber}&email=${encodeURIComponent(email)}`);
      } else {
        alert(`Order creation failed: ${data.error}`);
        setProcessing(false);
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      alert('Payment processing failed');
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '18px', color: '#666' }}>Loading checkout...</div>
      </div>
    );
  }

  if (!orderSummary) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '18px', color: '#666' }}>Unable to load checkout</div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <div style={{ display: 'grid', gap: '40px' }}>
        {/* Order Summary */}
        <div style={{
          background: '#f5f5f5',
          padding: '20px',
          borderRadius: '8px'
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>
            Order Summary
          </h2>
          <div style={{ marginBottom: '16px' }}>
            {orderSummary.items.map((item, idx) => (
              <div key={idx} style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '8px',
                fontSize: '14px'
              }}>
                <span>{item.quantity}x {item.brand} {item.name}</span>
                <span>${item.lineTotal.toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid #ddd', paddingTop: '12px', fontSize: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>Subtotal</span>
              <span>${orderSummary.subtotal.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>Shipping</span>
              <span>{orderSummary.shipping === 0 ? 'FREE' : `$${orderSummary.shipping.toFixed(2)}`}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span>Tax</span>
              <span>${orderSummary.tax.toFixed(2)}</span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '18px',
              fontWeight: 'bold',
              paddingTop: '12px',
              borderTop: '2px solid #000'
            }}>
              <span>Total</span>
              <span>${orderSummary.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Shipping Address */}
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>
            Shipping Address
          </h2>
          <div style={{ display: 'grid', gap: '12px' }}>
            <input
              type="text"
              placeholder="Full Name *"
              value={shippingAddress.fullName}
              onChange={(e) => setShippingAddress({ ...shippingAddress, fullName: e.target.value })}
              required
              style={{
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
            <input
              type="text"
              placeholder="Address Line 1 *"
              value={shippingAddress.addressLine1}
              onChange={(e) => setShippingAddress({ ...shippingAddress, addressLine1: e.target.value })}
              required
              style={{
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
            <input
              type="text"
              placeholder="Address Line 2 (Optional)"
              value={shippingAddress.addressLine2}
              onChange={(e) => setShippingAddress({ ...shippingAddress, addressLine2: e.target.value })}
              style={{
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <input
                type="text"
                placeholder="City *"
                value={shippingAddress.city}
                onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })}
                required
                style={{
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
              <input
                type="text"
                placeholder="State *"
                value={shippingAddress.stateProvince}
                onChange={(e) => setShippingAddress({ ...shippingAddress, stateProvince: e.target.value })}
                required
                style={{
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <input
                type="text"
                placeholder="Postal Code *"
                value={shippingAddress.postalCode}
                onChange={(e) => setShippingAddress({ ...shippingAddress, postalCode: e.target.value })}
                required
                style={{
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
              <input
                type="tel"
                placeholder="Phone (Optional)"
                value={shippingAddress.phone}
                onChange={(e) => setShippingAddress({ ...shippingAddress, phone: e.target.value })}
                style={{
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>
            <textarea
              placeholder="Delivery Notes (Optional)"
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              rows={3}
              style={{
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px',
                resize: 'vertical'
              }}
            />
          </div>
        </div>

        {/* Payment Details */}
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>
            Payment Details
          </h2>
          <div style={{
            padding: '20px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            background: '#fff'
          }}>
            <PaymentElement />
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!stripe || processing}
          style={{
            width: '100%',
            padding: '16px',
            background: '#000',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: processing ? 'not-allowed' : 'pointer',
            opacity: processing ? 0.6 : 1,
          }}
        >
          {processing ? 'Processing...' : `Pay $${orderSummary.total.toFixed(2)}`}
        </button>

        {/* Security Note */}
        <div style={{ textAlign: 'center', fontSize: '12px', color: '#666' }}>
          🔒 Secure payment powered by Stripe
        </div>
      </div>
    </form>
  );
}

// Main Checkout Page Component
function CheckoutPageContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email');
  const planCode = searchParams.get('planCode');
  const [clientSecret, setClientSecret] = useState('');

  useEffect(() => {
    if (!email) {
      alert('Email required for checkout');
      return;
    }

    // Initialize payment intent
    const initPayment = async () => {
      try {
        const response = await fetch('/api/checkout/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, planCode }),
        });

        const data = await response.json();
        if (data.success) {
          setClientSecret(data.clientSecret);
        }
      } catch (error) {
        console.error('Error initializing payment:', error);
      }
    };

    initPayment();
  }, [email, planCode]);

  if (!email) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>Invalid Checkout</h1>
        <p>Email is required to proceed with checkout.</p>
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '18px', color: '#666' }}>Initializing checkout...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fff', padding: '40px 20px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: '600', marginBottom: '8px' }}>
            Checkout
          </h1>
          <p style={{ color: '#666', fontSize: '16px' }}>
            Complete your supplement order
          </p>
        </div>

        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: { theme: 'stripe' },
          }}
        >
          <CheckoutForm email={email} planCode={planCode || undefined} />
        </Elements>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '18px', color: '#666' }}>Loading...</div>
      </div>
    }>
      <CheckoutPageContent />
    </Suspense>
  );
}
