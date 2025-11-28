/**
 * Order Processing Service
 *
 * Handles order creation, payment processing, and fulfillment
 */

import { createClient } from '@supabase/supabase-js';
import { validateCart, deactivateCart, type Cart, type CartItem } from './cart';
import { calculateOrderTotal } from '../stripe';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Types
export interface ShippingAddress {
  fullName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
  phone?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  userEmail: string;
  planCode: string | null;

  // Pricing
  subtotal: number;
  shippingCost: number;
  taxAmount: number;
  total: number;

  // Payment
  paymentMethod: string;
  paymentStatus: 'pending' | 'processing' | 'paid' | 'failed' | 'refunded';
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  paidAt: string | null;

  // Fulfillment
  fulfillmentStatus: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  trackingNumber: string | null;
  trackingCarrier: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;

  // Items
  items: OrderItem[];

  // Shipping
  shippingAddress: ShippingAddress | null;

  // Metadata
  createdAt: string;
  updatedAt: string;
  notes: string | null;
  customerNotes: string | null;
}

export interface OrderItem {
  id: string;
  productId: string;
  productSku: string;
  productName: string;
  productBrand: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

/**
 * Creates an order from a cart
 */
export async function createOrderFromCart(
  userEmail: string,
  shippingAddress: ShippingAddress,
  stripePaymentIntentId: string,
  customerNotes?: string
): Promise<{ order: Order | null; error: string | null }> {
  try {
    console.log(`[Order Service] Creating order for ${userEmail}`);

    // Validate cart
    const cartValidation = await validateCart(userEmail);

    if (!cartValidation.valid || !cartValidation.cart) {
      return {
        order: null,
        error: cartValidation.issues.join(', ') || 'Invalid cart',
      };
    }

    const cart = cartValidation.cart;

    // Calculate order totals
    const { subtotal, shipping, tax, total } = calculateOrderTotal(cart.subtotal);

    console.log(`[Order Service] Order totals: subtotal=$${subtotal}, shipping=$${shipping}, tax=$${tax}, total=$${total}`);

    // Create shipping address record
    const { data: addressData, error: addressError } = await supabase
      .from('shipping_addresses')
      .insert({
        user_email: userEmail,
        full_name: shippingAddress.fullName,
        address_line1: shippingAddress.addressLine1,
        address_line2: shippingAddress.addressLine2 || null,
        city: shippingAddress.city,
        state_province: shippingAddress.stateProvince,
        postal_code: shippingAddress.postalCode,
        country: shippingAddress.country || 'US',
        phone: shippingAddress.phone || null,
      })
      .select()
      .single();

    if (addressError || !addressData) {
      console.error('[Order Service] Error creating shipping address:', addressError);
      return {
        order: null,
        error: 'Failed to save shipping address',
      };
    }

    // Create order
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_email: userEmail,
        plan_code: cart.planCode,
        subtotal,
        shipping_cost: shipping,
        tax_amount: tax,
        total_amount: total,
        payment_method: 'stripe',
        payment_status: 'processing',
        stripe_payment_intent_id: stripePaymentIntentId,
        fulfillment_status: 'pending',
        customer_notes: customerNotes || null,
      })
      .select()
      .single();

    if (orderError || !orderData) {
      console.error('[Order Service] Error creating order:', orderError);
      return {
        order: null,
        error: 'Failed to create order',
      };
    }

    console.log(`[Order Service] Created order ${orderData.order_number} (${orderData.id})`);

    // Link shipping address to order
    await supabase
      .from('shipping_addresses')
      .update({ order_id: orderData.id })
      .eq('id', addressData.id);

    // Create order items from cart items
    const orderItems = cart.items.map((item: CartItem) => ({
      order_id: orderData.id,
      product_id: item.productId,
      product_sku: item.sku,
      product_name: item.name,
      product_brand: item.brand,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      line_total: item.lineTotal,
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems);

    if (itemsError) {
      console.error('[Order Service] Error creating order items:', itemsError);
      // Rollback: delete order
      await supabase.from('orders').delete().eq('id', orderData.id);
      return {
        order: null,
        error: 'Failed to create order items',
      };
    }

    console.log(`[Order Service] Created ${orderItems.length} order items`);

    // Deactivate cart (cart items will remain for reference)
    await deactivateCart(cart.id, orderData.id);

    // Note: Inventory will be automatically deducted by the database trigger
    // when order_items are inserted

    // Fetch complete order
    const { order, error: fetchError } = await getOrder(orderData.id);

    if (fetchError || !order) {
      console.error('[Order Service] Error fetching created order:', fetchError);
      return {
        order: null,
        error: 'Order created but failed to fetch',
      };
    }

    console.log(`[Order Service] ✅ Order ${order.orderNumber} created successfully`);

    return { order, error: null };
  } catch (error) {
    console.error('[Order Service] Error:', error);
    return {
      order: null,
      error: error instanceof Error ? error.message : 'Failed to create order',
    };
  }
}

/**
 * Gets an order by ID
 */
export async function getOrder(
  orderId: string
): Promise<{ order: Order | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (*),
        shipping_addresses (*)
      `)
      .eq('id', orderId)
      .single();

    if (error || !data) {
      return { order: null, error: 'Order not found' };
    }

    const order = transformToOrder(data);
    return { order, error: null };
  } catch (error) {
    console.error('[Order Service] Error:', error);
    return { order: null, error: 'Failed to get order' };
  }
}

/**
 * Gets an order by order number
 */
export async function getOrderByNumber(
  orderNumber: string
): Promise<{ order: Order | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (*),
        shipping_addresses (*)
      `)
      .eq('order_number', orderNumber)
      .single();

    if (error || !data) {
      return { order: null, error: 'Order not found' };
    }

    const order = transformToOrder(data);
    return { order, error: null };
  } catch (error) {
    console.error('[Order Service] Error:', error);
    return { order: null, error: 'Failed to get order' };
  }
}

/**
 * Gets orders for a user
 */
export async function getUserOrders(
  userEmail: string,
  limit: number = 10
): Promise<{ orders: Order[]; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (*),
        shipping_addresses (*)
      `)
      .eq('user_email', userEmail)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return { orders: [], error: 'Failed to get orders' };
    }

    const orders = (data || []).map(transformToOrder);
    return { orders, error: null };
  } catch (error) {
    console.error('[Order Service] Error:', error);
    return { orders: [], error: 'Failed to get orders' };
  }
}

/**
 * Updates order payment status
 */
export async function updateOrderPaymentStatus(
  orderId: string,
  paymentStatus: 'pending' | 'processing' | 'paid' | 'failed' | 'refunded',
  stripeChargeId?: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const updateData: any = {
      payment_status: paymentStatus,
    };

    if (paymentStatus === 'paid') {
      updateData.paid_at = new Date().toISOString();
    }

    if (stripeChargeId) {
      updateData.stripe_charge_id = stripeChargeId;
    }

    const { error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId);

    if (error) {
      console.error('[Order Service] Error updating payment status:', error);
      return { success: false, error: 'Failed to update payment status' };
    }

    console.log(`[Order Service] Updated order ${orderId} payment status to ${paymentStatus}`);

    return { success: true, error: null };
  } catch (error) {
    console.error('[Order Service] Error:', error);
    return { success: false, error: 'Failed to update payment status' };
  }
}

/**
 * Updates order fulfillment status
 */
export async function updateOrderFulfillmentStatus(
  orderId: string,
  fulfillmentStatus: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled',
  trackingNumber?: string,
  trackingCarrier?: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const updateData: any = {
      fulfillment_status: fulfillmentStatus,
    };

    if (trackingNumber) {
      updateData.tracking_number = trackingNumber;
    }

    if (trackingCarrier) {
      updateData.tracking_carrier = trackingCarrier;
    }

    if (fulfillmentStatus === 'shipped') {
      updateData.shipped_at = new Date().toISOString();
    } else if (fulfillmentStatus === 'delivered') {
      updateData.delivered_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId);

    if (error) {
      console.error('[Order Service] Error updating fulfillment status:', error);
      return { success: false, error: 'Failed to update fulfillment status' };
    }

    console.log(`[Order Service] Updated order ${orderId} fulfillment status to ${fulfillmentStatus}`);

    return { success: true, error: null };
  } catch (error) {
    console.error('[Order Service] Error:', error);
    return { success: false, error: 'Failed to update fulfillment status' };
  }
}

/**
 * Cancels an order
 */
export async function cancelOrder(
  orderId: string,
  reason?: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (fetchError || !order) {
      return { success: false, error: 'Order not found' };
    }

    // Can only cancel if not yet shipped
    if (order.fulfillment_status === 'shipped' || order.fulfillment_status === 'delivered') {
      return {
        success: false,
        error: 'Cannot cancel order that has already been shipped',
      };
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update({
        fulfillment_status: 'cancelled',
        notes: reason || 'Order cancelled by customer',
      })
      .eq('id', orderId);

    if (updateError) {
      return { success: false, error: 'Failed to cancel order' };
    }

    // TODO: Restore inventory (create return inventory transactions)

    console.log(`[Order Service] Cancelled order ${orderId}`);

    return { success: true, error: null };
  } catch (error) {
    console.error('[Order Service] Error:', error);
    return { success: false, error: 'Failed to cancel order' };
  }
}

/**
 * Helper function to transform database order to Order type
 */
function transformToOrder(dbOrder: any): Order {
  const items: OrderItem[] = (dbOrder.order_items || []).map((item: any) => ({
    id: item.id,
    productId: item.product_id,
    productSku: item.product_sku,
    productName: item.product_name,
    productBrand: item.product_brand,
    quantity: item.quantity,
    unitPrice: parseFloat(item.unit_price),
    lineTotal: parseFloat(item.line_total),
  }));

  const shippingAddresses = Array.isArray(dbOrder.shipping_addresses)
    ? dbOrder.shipping_addresses
    : [dbOrder.shipping_addresses];

  const shippingAddress =
    shippingAddresses && shippingAddresses.length > 0
      ? {
          fullName: shippingAddresses[0].full_name,
          addressLine1: shippingAddresses[0].address_line1,
          addressLine2: shippingAddresses[0].address_line2,
          city: shippingAddresses[0].city,
          stateProvince: shippingAddresses[0].state_province,
          postalCode: shippingAddresses[0].postal_code,
          country: shippingAddresses[0].country,
          phone: shippingAddresses[0].phone,
        }
      : null;

  return {
    id: dbOrder.id,
    orderNumber: dbOrder.order_number,
    userEmail: dbOrder.user_email,
    planCode: dbOrder.plan_code,

    subtotal: parseFloat(dbOrder.subtotal),
    shippingCost: parseFloat(dbOrder.shipping_cost),
    taxAmount: parseFloat(dbOrder.tax_amount),
    total: parseFloat(dbOrder.total_amount),

    paymentMethod: dbOrder.payment_method,
    paymentStatus: dbOrder.payment_status,
    stripePaymentIntentId: dbOrder.stripe_payment_intent_id,
    stripeChargeId: dbOrder.stripe_charge_id,
    paidAt: dbOrder.paid_at,

    fulfillmentStatus: dbOrder.fulfillment_status,
    trackingNumber: dbOrder.tracking_number,
    trackingCarrier: dbOrder.tracking_carrier,
    shippedAt: dbOrder.shipped_at,
    deliveredAt: dbOrder.delivered_at,

    items,
    shippingAddress,

    createdAt: dbOrder.created_at,
    updatedAt: dbOrder.updated_at,
    notes: dbOrder.notes,
    customerNotes: dbOrder.customer_notes,
  };
}
