'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface CartItem {
  id: string;
  productId: string;
  sku: string;
  name: string;
  brand: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  imageUrl: string;
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
}

export default function ShoppingCart({ userEmail, planCode }: ShoppingCartProps) {
  const router = useRouter();
  const [cart, setCart] = useState<Cart | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

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
    }
  }, [userEmail]);

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

  if (!cart) return null;

  return (
    <>
      {/* Floating Cart Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-8 right-8 bg-black text-white rounded-full w-16 h-16 flex items-center justify-center shadow-lg hover:bg-gray-800 transition-all z-50"
        style={{ fontSize: '24px' }}
      >
        🛒
        {cart.itemCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
            {cart.itemCount}
          </span>
        )}
      </button>

      {/* Cart Drawer */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-50"
            onClick={() => setIsOpen(false)}
          />

          {/* Drawer */}
          <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-gray-900">
                Your Cart ({cart.itemCount})
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
                style={{ fontSize: '24px' }}
              >
                ✕
              </button>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-6">
              {cart.items.length === 0 ? (
                <div className="text-center text-gray-500 py-12">
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>🛒</div>
                  <p>Your cart is empty</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cart.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex gap-4 p-4 border border-gray-200 rounded-lg"
                    >
                      {/* Product Image */}
                      <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                        <span style={{ fontSize: '32px' }}>💊</span>
                      </div>

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
                            className="w-8 h-8 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            −
                          </button>
                          <span className="w-8 text-center">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            disabled={loading}
                            className="w-8 h-8 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    <p className="text-green-600 font-medium">🎉 Free shipping!</p>
                  ) : (
                    <p>Free shipping on orders over $75</p>
                  )}
                </div>

                {/* Checkout Button */}
                <button
                  onClick={proceedToCheckout}
                  disabled={loading}
                  className="w-full bg-black text-white py-4 rounded-lg font-semibold hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Proceed to Checkout
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
