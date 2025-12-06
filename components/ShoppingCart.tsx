'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface CartItem {
  id: string;
  productId: string;
  sku: string;
  name: string;
  brand: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  inStock: boolean;
}

interface Cart {
  id: string;
  items: CartItem[];
  itemCount: number;
  totalItems: number;
  subtotal: number;
}

interface ShoppingCartProps {
  userEmail: string;
  planCode?: string;
  isOpen?: boolean;
  onClose?: () => void;
}

interface SavedAddress {
  id: string;
  full_name: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state_province: string;
  postal_code: string;
  country: string;
  phone?: string;
  is_default: boolean;
}

export default function ShoppingCart({ userEmail, planCode, isOpen: controlledIsOpen, onClose }: ShoppingCartProps) {
  const router = useRouter();
  const [cart, setCart] = useState<Cart | null>(null);
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasAddress, setHasAddress] = useState(false);
  const [defaultAddress, setDefaultAddress] = useState<SavedAddress | null>(null);
  const [showOneClickModal, setShowOneClickModal] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  // Use controlled state if provided, otherwise use internal state
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = onClose ? onClose : setInternalIsOpen;

  // Fetch cart
  const fetchCart = async () => {
    try {
      const response = await fetch(`/api/cart?email=${encodeURIComponent(userEmail)}`);
      const data = await response.json();

      if (data.success) {
        setCart(data.cart);
      }
    } catch (error) {
      console.error('Error fetching cart:', error);
    }
  };

  useEffect(() => {
    if (userEmail) {
      fetchCart();
      checkSavedAddress();
    }
  }, [userEmail]);

  // Check if user has saved address for one-click checkout
  const checkSavedAddress = async () => {
    try {
      const response = await fetch(`/api/checkout/one-click?email=${encodeURIComponent(userEmail)}`);
      const data = await response.json();

      if (data.success && data.hasAddress) {
        setHasAddress(true);
        setDefaultAddress(data.defaultAddress);
      }
    } catch (error) {
      console.error('Error checking saved address:', error);
    }
  };

  // Update quantity
  const updateQuantity = async (cartItemId: string, quantity: number) => {
    setLoading(true);
    try {
      const response = await fetch('/api/cart/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          cartItemId,
          quantity,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setCart(data.cart);
      }
    } catch (error) {
      console.error('Error updating quantity:', error);
    } finally {
      setLoading(false);
    }
  };

  // Remove item
  const removeItem = async (cartItemId: string) => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/cart/remove?email=${encodeURIComponent(userEmail)}&cartItemId=${cartItemId}`,
        { method: 'DELETE' }
      );

      const data = await response.json();
      if (data.success) {
        setCart(data.cart);
      }
    } catch (error) {
      console.error('Error removing item:', error);
    } finally {
      setLoading(false);
    }
  };

  // Proceed to checkout
  const proceedToCheckout = () => {
    setIsOpen(false);
    router.push(`/checkout?email=${encodeURIComponent(userEmail)}${planCode ? `&planCode=${planCode}` : ''}`);
  };

  // Handle one-click checkout
  const handleOneClickCheckout = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/checkout/one-click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail }),
      });

      const data = await response.json();

      if (data.success && data.clientSecret) {
        setClientSecret(data.clientSecret);
        setShowOneClickModal(true);
      } else {
        alert(data.error || 'One-click checkout failed');
      }
    } catch (error) {
      console.error('Error initiating one-click checkout:', error);
      alert('Failed to initiate one-click checkout');
    } finally {
      setLoading(false);
    }
  };

  // One-Click Payment Form Component
  function OneClickPaymentForm({ onSuccess }: { onSuccess: () => void }) {
    const stripe = useStripe();
    const elements = useElements();
    const [processing, setProcessing] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();

      if (!stripe || !elements || !clientSecret) return;

      setProcessing(true);

      try {
        const { error } = await stripe.confirmPayment({
          elements,
          redirect: 'if_required',
        });

        if (error) {
          alert(`Payment failed: ${error.message}`);
          setProcessing(false);
        } else {
          // Payment succeeded - create order with saved address
          const response = await fetch('/api/checkout/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: userEmail,
              paymentIntentId: clientSecret.split('_secret_')[0],
              shippingAddress: {
                fullName: defaultAddress?.full_name,
                addressLine1: defaultAddress?.address_line1,
                addressLine2: defaultAddress?.address_line2,
                city: defaultAddress?.city,
                stateProvince: defaultAddress?.state_province,
                postalCode: defaultAddress?.postal_code,
                country: defaultAddress?.country,
                phone: defaultAddress?.phone,
              },
              customerNotes: '',
              saveAddress: false, // Already saved
            }),
          });

          const data = await response.json();

          if (data.success) {
            onSuccess();
            router.push(`/order-confirmation?orderNumber=${data.order.orderNumber}&email=${encodeURIComponent(userEmail)}`);
          } else {
            alert('Order creation failed');
            setProcessing(false);
          }
        }
      } catch (error) {
        console.error('Payment error:', error);
        alert('Payment failed');
        setProcessing(false);
      }
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <h3 className="font-semibold text-lg mb-4">Complete Payment</h3>
          <div className="bg-gray-50 p-4 rounded-lg mb-4">
            <p className="text-sm text-gray-600 mb-2">Shipping to:</p>
            <p className="font-medium">{defaultAddress?.full_name}</p>
            <p className="text-sm text-gray-700">
              {defaultAddress?.address_line1}
              {defaultAddress?.address_line2 && `, ${defaultAddress.address_line2}`}
            </p>
            <p className="text-sm text-gray-700">
              {defaultAddress?.city}, {defaultAddress?.state_province} {defaultAddress?.postal_code}
            </p>
          </div>
        </div>

        <PaymentElement />

        <button
          type="submit"
          disabled={!stripe || processing}
          className="w-full bg-green-600 text-white py-4 rounded-lg font-semibold hover:bg-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {processing ? 'Processing...' : `Pay $${cart?.subtotal.toFixed(2)}`}
        </button>
      </form>
    );
  }

  if (!cart) return null;

  return (
    <>
      {/* Cart Drawer */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-[200]"
            onClick={() => setIsOpen(false)}
          />

          {/* Drawer */}
          <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-[200] flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-gray-900">
                Your Cart ({cart.itemCount})
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-6">
              {cart.items.length === 0 ? (
                <div className="text-center text-gray-500 py-12">
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-4 text-gray-300">
                    <circle cx="9" cy="21" r="1"/>
                    <circle cx="20" cy="21" r="1"/>
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                  </svg>
                  <p>Your cart is empty</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cart.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex gap-4 p-4 border border-gray-200 rounded-lg"
                    >
                      {/* Product Details */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 text-sm">
                          {item.brand} {item.name}
                        </h3>
                        <p className="text-sm text-gray-600">${item.unitPrice.toFixed(2)}</p>

                        {/* Quantity Controls */}
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            disabled={loading || item.quantity <= 1}
                            className="w-8 h-8 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900"
                          >
                            −
                          </button>
                          <span className="w-8 text-center font-semibold text-gray-900">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            disabled={loading}
                            className="w-8 h-8 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900"
                          >
                            +
                          </button>
                          <button
                            onClick={() => removeItem(item.id)}
                            disabled={loading}
                            className="ml-auto text-red-500 text-sm hover:text-red-700 disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      {/* Line Total */}
                      <div className="text-right flex-shrink-0">
                        <p className="font-semibold text-gray-900">
                          ${item.lineTotal.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {cart.items.length > 0 && (
              <div className="border-t border-gray-200 p-6 space-y-4">
                {/* Subtotal */}
                <div className="flex justify-between text-lg">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-semibold text-gray-900">
                    ${cart.subtotal.toFixed(2)}
                  </span>
                </div>

                {/* Shipping Info */}
                <div className="text-sm text-gray-500">
                  {cart.subtotal >= 75 ? (
                    <p className="text-green-600 font-medium">✓ Free shipping</p>
                  ) : (
                    <p>Free shipping on orders over $75</p>
                  )}
                </div>

                {/* Checkout Buttons */}
                <div className="space-y-3">
                  {/* One-Click Checkout (if address saved) */}
                  {hasAddress && defaultAddress && (
                    <button
                      onClick={handleOneClickCheckout}
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white py-4 rounded-lg font-semibold hover:from-green-700 hover:to-green-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center justify-center gap-2"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                      </svg>
                      Quick Checkout
                    </button>
                  )}

                  {/* Regular Checkout */}
                  <button
                    onClick={proceedToCheckout}
                    disabled={loading}
                    className={`w-full ${hasAddress ? 'bg-gray-800' : 'bg-black'} text-white py-4 rounded-lg font-semibold hover:bg-gray-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {hasAddress ? 'Standard Checkout' : 'Proceed to Checkout'}
                  </button>
                </div>

                {/* Saved Address Info */}
                {hasAddress && defaultAddress && (
                  <div className="text-xs text-gray-500 text-center pt-2 border-t border-gray-100">
                    <p>Quick checkout ships to:</p>
                    <p className="font-medium text-gray-700">
                      {defaultAddress.address_line1}, {defaultAddress.city}, {defaultAddress.state_province}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* One-Click Checkout Modal */}
      {showOneClickModal && clientSecret && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-60 z-[300]"
            onClick={() => setShowOneClickModal(false)}
          />

          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center z-[300] p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative">
              {/* Close Button */}
              <button
                onClick={() => setShowOneClickModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>

              {/* Modal Content */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-600">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                  </svg>
                  <h2 className="text-2xl font-bold text-gray-900">Quick Checkout</h2>
                </div>
                <p className="text-sm text-gray-600">Complete your purchase in seconds</p>
              </div>

              {/* Stripe Payment Form */}
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret,
                  appearance: { theme: 'stripe' },
                }}
              >
                <OneClickPaymentForm onSuccess={() => setShowOneClickModal(false)} />
              </Elements>
            </div>
          </div>
        </>
      )}
    </>
  );
}
