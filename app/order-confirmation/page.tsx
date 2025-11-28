'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

interface Order {
  orderNumber: string;
  total: number;
  items: Array<{
    productName: string;
    productBrand: string;
    quantity: number;
    lineTotal: number;
  }>;
  shippingAddress: {
    fullName: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    stateProvince: string;
    postalCode: string;
  } | null;
  subtotal: number;
  shippingCost: number;
  taxAmount: number;
}

function OrderConfirmationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderNumber = searchParams.get('orderNumber');
  const email = searchParams.get('email');

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderNumber || !email) {
      setLoading(false);
      return;
    }

    // Fetch order details
    const fetchOrder = async () => {
      try {
        const response = await fetch(
          `/api/orders?email=${encodeURIComponent(email)}&orderNumber=${encodeURIComponent(orderNumber)}`
        );

        const data = await response.json();
        if (data.success && data.order) {
          setOrder(data.order);
        }
      } catch (error) {
        console.error('Error fetching order:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderNumber, email]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#f8f8f8'
      }}>
        <div style={{ fontSize: '18px', color: '#666' }}>Loading order...</div>
      </div>
    );
  }

  if (!orderNumber) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '20px'
      }}>
        <h1 style={{ fontSize: '32px', marginBottom: '16px' }}>Invalid Order</h1>
        <p style={{ color: '#666', marginBottom: '24px' }}>No order number provided</p>
        <button
          onClick={() => router.push('/')}
          style={{
            padding: '12px 24px',
            background: '#000',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          Return Home
        </button>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8f8f8',
      padding: '40px 20px'
    }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        {/* Success Icon */}
        <div style={{
          textAlign: 'center',
          marginBottom: '32px'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            background: '#10b981',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            fontSize: '40px'
          }}>
            ✓
          </div>
          <h1 style={{
            fontSize: '32px',
            fontWeight: '600',
            marginBottom: '8px',
            color: '#1a1a1a'
          }}>
            Order Confirmed!
          </h1>
          <p style={{ fontSize: '16px', color: '#666' }}>
            Thank you for your purchase
          </p>
        </div>

        {/* Order Details Card */}
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          marginBottom: '24px'
        }}>
          <div style={{ marginBottom: '24px' }}>
            <div style={{
              fontSize: '14px',
              color: '#666',
              marginBottom: '4px'
            }}>
              Order Number
            </div>
            <div style={{
              fontSize: '24px',
              fontWeight: '600',
              fontFamily: 'monospace',
              color: '#1a1a1a'
            }}>
              {orderNumber}
            </div>
          </div>

          {order && (
            <>
              {/* Order Items */}
              <div style={{
                borderTop: '1px solid #e5e5e5',
                paddingTop: '20px',
                marginBottom: '20px'
              }}>
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  marginBottom: '12px'
                }}>
                  Order Items
                </h3>
                <div style={{ display: 'grid', gap: '12px' }}>
                  {order.items.map((item, idx) => (
                    <div key={idx} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '14px'
                    }}>
                      <span>
                        {item.quantity}x {item.productBrand} {item.productName}
                      </span>
                      <span style={{ fontWeight: '600' }}>
                        ${item.lineTotal.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Totals */}
              <div style={{
                borderTop: '1px solid #e5e5e5',
                paddingTop: '16px',
                fontSize: '14px'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '8px'
                }}>
                  <span>Subtotal</span>
                  <span>${order.subtotal.toFixed(2)}</span>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '8px'
                }}>
                  <span>Shipping</span>
                  <span>{order.shippingCost === 0 ? 'FREE' : `$${order.shippingCost.toFixed(2)}`}</span>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '16px'
                }}>
                  <span>Tax</span>
                  <span>${order.taxAmount.toFixed(2)}</span>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingTop: '16px',
                  borderTop: '2px solid #1a1a1a',
                  fontSize: '18px',
                  fontWeight: '600'
                }}>
                  <span>Total</span>
                  <span>${order.total.toFixed(2)}</span>
                </div>
              </div>

              {/* Shipping Address */}
              {order.shippingAddress && (
                <div style={{
                  borderTop: '1px solid #e5e5e5',
                  paddingTop: '20px',
                  marginTop: '20px'
                }}>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    marginBottom: '8px'
                  }}>
                    Shipping Address
                  </h3>
                  <div style={{ fontSize: '14px', color: '#666', lineHeight: '1.6' }}>
                    <div>{order.shippingAddress.fullName}</div>
                    <div>{order.shippingAddress.addressLine1}</div>
                    {order.shippingAddress.addressLine2 && (
                      <div>{order.shippingAddress.addressLine2}</div>
                    )}
                    <div>
                      {order.shippingAddress.city}, {order.shippingAddress.stateProvince} {order.shippingAddress.postalCode}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Next Steps */}
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          marginBottom: '24px'
        }}>
          <h3 style={{
            fontSize: '18px',
            fontWeight: '600',
            marginBottom: '12px'
          }}>
            What's Next?
          </h3>
          <div style={{ fontSize: '14px', color: '#666', lineHeight: '1.8' }}>
            <div style={{ marginBottom: '8px' }}>
              ✓ You'll receive an email confirmation at {email}
            </div>
            <div style={{ marginBottom: '8px' }}>
              📦 Your order will be processed within 1-2 business days
            </div>
            <div style={{ marginBottom: '8px' }}>
              🚚 You'll receive tracking information once shipped
            </div>
            <div>
              💬 Questions? Contact us at support@moccet.ai
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{
          display: 'grid',
          gap: '12px'
        }}>
          <button
            onClick={() => router.push(`/forge/personalised-plan?email=${encodeURIComponent(email || '')}`)}
            style={{
              padding: '16px',
              background: '#000',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            View Your Plan
          </button>
          <button
            onClick={() => router.push('/')}
            style={{
              padding: '16px',
              background: '#fff',
              color: '#000',
              border: '2px solid #000',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Return Home
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OrderConfirmationPage() {
  return (
    <Suspense fallback={
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh'
      }}>
        <div style={{ fontSize: '18px', color: '#666' }}>Loading...</div>
      </div>
    }>
      <OrderConfirmationContent />
    </Suspense>
  );
}
