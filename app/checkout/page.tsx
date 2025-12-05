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
import Image from 'next/image';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface CartItem {
  id?: string;
  productId?: string;
  name: string;
  brand: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  imageUrl?: string;
  imageLoading?: boolean;
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
  const [showOrderSummary, setShowOrderSummary] = useState(false);
  const [updatingCart, setUpdatingCart] = useState(false);

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

  // Update cart item quantity
  const updateQuantity = async (itemId: string, newQuantity: number) => {
    if (!itemId || updatingCart) return;

    setUpdatingCart(true);
    try {
      const response = await fetch('/api/cart/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          cartItemId: itemId,
          quantity: newQuantity,
        }),
      });

      const data = await response.json();
      if (data.success && data.cart) {
        // Recalculate order summary
        const subtotal = data.cart.subtotal;
        const shipping = subtotal >= 75 ? 0 : 9.99;
        const tax = subtotal * 0.08;
        const total = subtotal + shipping + tax;

        setOrderSummary({
          subtotal,
          shipping,
          tax,
          total,
          items: data.cart.items.map((item: any) => ({
            id: item.id,
            name: item.name,
            brand: item.brand,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
            imageUrl: item.imageUrl,
          })),
        });
      }
    } catch (error) {
      console.error('Error updating quantity:', error);
      alert('Failed to update quantity');
    } finally {
      setUpdatingCart(false);
    }
  };

  // Remove cart item
  const removeItem = async (itemId: string) => {
    if (!itemId || updatingCart) return;

    setUpdatingCart(true);
    try {
      const response = await fetch(
        `/api/cart/remove?email=${encodeURIComponent(email)}&cartItemId=${itemId}`,
        { method: 'DELETE' }
      );

      const data = await response.json();
      if (data.success && data.cart) {
        // Recalculate order summary
        const subtotal = data.cart.subtotal;
        const shipping = subtotal >= 75 ? 0 : 9.99;
        const tax = subtotal * 0.08;
        const total = subtotal + shipping + tax;

        setOrderSummary({
          subtotal,
          shipping,
          tax,
          total,
          items: data.cart.items.map((item: any) => ({
            id: item.id,
            name: item.name,
            brand: item.brand,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
            imageUrl: item.imageUrl,
          })),
        });

        // If cart is empty, redirect back
        if (data.cart.items.length === 0) {
          alert('Your cart is empty');
          router.back();
        }
      }
    } catch (error) {
      console.error('Error removing item:', error);
      alert('Failed to remove item');
    } finally {
      setUpdatingCart(false);
    }
  };

  // Fetch product image on-demand
  const fetchProductImage = async (productId: string) => {
    try {
      const response = await fetch('/api/products/ensure-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      });

      const data = await response.json();

      if (data.success && data.imageUrl) {
        // Update order summary with new image
        setOrderSummary((prev) => {
          if (!prev) return prev;

          return {
            ...prev,
            items: prev.items.map((item) =>
              item.productId === productId
                ? { ...item, imageUrl: data.imageUrl, imageLoading: false }
                : item
            ),
          };
        });
      }
    } catch (error) {
      console.error('Error fetching product image:', error);
    }
  };

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

          // Trigger on-demand image fetching for items without images
          if (data.orderSummary?.items) {
            data.orderSummary.items.forEach((item: CartItem) => {
              if (item.imageLoading && item.productId) {
                fetchProductImage(item.productId);
              }
            });
          }
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading checkout...</div>
      </div>
    );
  }

  if (!orderSummary) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-600">Unable to load checkout</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Mobile Order Summary Toggle */}
      <div className="lg:hidden border-b border-gray-200 bg-gray-50">
        <button
          onClick={() => setShowOrderSummary(!showOrderSummary)}
          className="w-full px-6 py-4 flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="9" cy="21" r="1"/>
              <circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
            <span className="font-semibold">
              {showOrderSummary ? 'Hide' : 'Show'} order summary
            </span>
          </div>
          <span className="text-xl font-bold">${orderSummary.total.toFixed(2)}</span>
        </button>

        {showOrderSummary && (
          <div className="px-6 py-4 border-t border-gray-200">
            {orderSummary.items.map((item, idx) => (
              <div key={idx} className="flex gap-4 mb-4">
                <div className="w-16 h-16 bg-gray-100 rounded-lg flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-sm">{item.brand} {item.name}</p>
                  <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                </div>
                <p className="font-semibold">${item.lineTotal.toFixed(2)}</p>
              </div>
            ))}
            <div className="border-t border-gray-200 pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>${orderSummary.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Shipping</span>
                <span>{orderSummary.shipping === 0 ? 'FREE' : `$${orderSummary.shipping.toFixed(2)}`}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Tax</span>
                <span>${orderSummary.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2">
                <span>Total</span>
                <span>${orderSummary.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="lg:grid lg:grid-cols-[1fr_480px] lg:gap-0 lg:h-screen">
        {/* Left Column - Scrollable Form */}
        <div className="lg:overflow-y-auto lg:border-r border-gray-200">
          <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-6 py-8 lg:py-12">
            {/* Logo/Brand */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-4">Checkout</h1>
              <img
                src="/images/3.png"
                alt="Checkout"
                className="w-full rounded-lg"
              />
            </div>

            {/* Shipping Address Section */}
            <div className="mb-10">
              <h2 className="text-2xl font-bold mb-2">Shipping address</h2>
              <p className="text-sm text-gray-600 mb-6">* indicates the field is required</p>

              <div className="space-y-4">
                {/* Country/Region */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Location / Region <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={shippingAddress.country}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, country: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                  >
                    <option value="US">United States</option>
                    <option value="UK">United Kingdom</option>
                    <option value="CA">Canada</option>
                  </select>
                </div>

                {/* First Name & Last Name */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      First name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={shippingAddress.fullName.split(' ')[0] || ''}
                      onChange={(e) => {
                        const lastName = shippingAddress.fullName.split(' ').slice(1).join(' ');
                        setShippingAddress({ ...shippingAddress, fullName: `${e.target.value} ${lastName}`.trim() });
                      }}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Last name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={shippingAddress.fullName.split(' ').slice(1).join(' ') || ''}
                      onChange={(e) => {
                        const firstName = shippingAddress.fullName.split(' ')[0] || '';
                        setShippingAddress({ ...shippingAddress, fullName: `${firstName} ${e.target.value}`.trim() });
                      }}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    placeholder="Phone number"
                    value={shippingAddress.phone}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, phone: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                  />
                </div>

                {/* Address Line 1 */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Address line 1 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Begin typing an address"
                    value={shippingAddress.addressLine1}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, addressLine1: e.target.value })}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                  />
                </div>

                {/* Address Line 2 */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Address line 2 (Optional)
                  </label>
                  <input
                    type="text"
                    value={shippingAddress.addressLine2}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, addressLine2: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                  />
                </div>

                {/* City & Postcode */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      City / Town <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={shippingAddress.city}
                      onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Postcode <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={shippingAddress.postalCode}
                      onChange={(e) => setShippingAddress({ ...shippingAddress, postalCode: e.target.value })}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                    />
                  </div>
                </div>

                {/* State/Province */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    State / Province <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={shippingAddress.stateProvince}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, stateProvince: e.target.value })}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                  />
                </div>

                {/* Delivery Notes */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Delivery Notes (Optional)
                  </label>
                  <textarea
                    value={customerNotes}
                    onChange={(e) => setCustomerNotes(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent resize-none"
                    placeholder="Add any special delivery instructions..."
                  />
                </div>
              </div>
            </div>

            {/* Payment Section */}
            <div className="mb-10">
              <h2 className="text-2xl font-bold mb-6">Payment</h2>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                <PaymentElement />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!stripe || processing}
              className="w-full bg-black text-white py-4 rounded-lg text-lg font-semibold hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? 'Processing...' : `Pay $${orderSummary.total.toFixed(2)}`}
            </button>

            {/* Security Badge */}
            <div className="mt-6 text-center text-sm text-gray-500">
              🔒 Secure payment powered by Stripe
            </div>
          </form>
        </div>

        {/* Right Column - Fixed Order Summary (Desktop Only) */}
        <div className="hidden lg:block lg:overflow-y-auto bg-gray-50">
          <div className="p-8 lg:p-12 lg:sticky lg:top-0">
            {/* Brand Header */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="font-black text-xl tracking-tight" style={{ fontFamily: 'Inter, sans-serif' }}>
                  moccet
                </span>
                <span className="text-xl text-gray-600">×</span>
                <span className="text-xl" style={{ fontFamily: 'Playfair Display, serif' }}>
                  The Wellness
                </span>
              </div>
              <img
                src="/images/checkout1.png"
                alt="The Wellness"
                className="w-full rounded-lg"
              />
            </div>

            <div className="mb-8 pb-6 border-b border-gray-300" />

            {/* Order Items */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="9" cy="21" r="1"/>
                    <circle cx="20" cy="21" r="1"/>
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                  </svg>
                  <h3 className="text-lg font-semibold">
                    {orderSummary.items.length} {orderSummary.items.length === 1 ? 'Item' : 'Items'}
                  </h3>
                </div>
                <button className="text-sm underline">
                  ∧
                </button>
              </div>

              {/* Items List */}
              <div className="space-y-6">
                {orderSummary.items.map((item, idx) => (
                  <div key={item.id || idx} className="flex gap-4">
                    {/* Product Image */}
                    <div className="relative flex-shrink-0">
                      <div className="w-20 h-20 bg-white border border-gray-200 rounded-lg flex items-center justify-center overflow-hidden">
                        {item.imageLoading ? (
                          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
                        ) : item.imageUrl ? (
                          <Image
                            src={item.imageUrl}
                            alt={`${item.brand} ${item.name}`}
                            width={80}
                            height={80}
                            className="w-full h-full object-cover rounded-lg"
                            onError={(e) => {
                              const target = e.currentTarget as HTMLImageElement;
                              target.src = '/images/supplements/default.svg';
                              target.style.objectFit = 'contain';
                            }}
                          />
                        ) : (
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-400">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            <circle cx="8.5" cy="8.5" r="1.5"></circle>
                            <polyline points="21 15 16 10 5 21"></polyline>
                          </svg>
                        )}
                      </div>
                    </div>

                    {/* Product Details */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm mb-1">
                        {item.brand} {item.name}
                      </h4>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => item.id && updateQuantity(item.id, item.quantity - 1)}
                          disabled={updatingCart || item.quantity <= 1}
                          className="w-6 h-6 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm"
                        >
                          −
                        </button>
                        <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                        <button
                          onClick={() => item.id && updateQuantity(item.id, item.quantity + 1)}
                          disabled={updatingCart}
                          className="w-6 h-6 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm"
                        >
                          +
                        </button>
                        <button
                          onClick={() => item.id && removeItem(item.id)}
                          disabled={updatingCart}
                          className="ml-auto text-xs text-red-500 hover:text-red-700 disabled:opacity-50 underline"
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    {/* Price */}
                    <div className="text-right font-semibold flex-shrink-0">
                      ${item.lineTotal.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Price Breakdown */}
            <div className="border-t border-gray-300 pt-6 space-y-3">
              <div className="flex justify-between text-base">
                <span>Subtotal</span>
                <span className="font-semibold">${orderSummary.subtotal.toFixed(2)}</span>
              </div>

              <div className="flex justify-between text-base">
                <span>Shipping</span>
                <span className="font-semibold">
                  {orderSummary.shipping === 0 ? 'FREE' : `$${orderSummary.shipping.toFixed(2)}`}
                </span>
              </div>

              <div className="flex justify-between text-base border-b border-gray-300 pb-3">
                <span>Tax</span>
                <span className="font-semibold">${orderSummary.tax.toFixed(2)}</span>
              </div>

              <div className="flex justify-between text-xl font-bold pt-2">
                <span>Total (VAT Included)</span>
                <span>${orderSummary.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
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
      console.error('[Checkout] ERROR: No email found in URL params');
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Invalid Checkout</h1>
          <p>Email is required to proceed with checkout.</p>
        </div>
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-600">Initializing checkout...</div>
      </div>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#000000',
            borderRadius: '8px',
          },
        },
      }}
    >
      <CheckoutForm email={email} planCode={planCode || undefined} />
    </Elements>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    }>
      <CheckoutPageContent />
    </Suspense>
  );
}
