/**
 * Shopping Cart Service
 *
 * Handles all shopping cart operations for supplement purchases
 */

import { createClient } from '@supabase/supabase-js';
import { validateProductAvailability } from './supplement-matching';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Types
export interface CartItem {
  id: string;
  productId: string;
  sku: string;
  name: string;
  brand: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  imageUrl: string;
  imageLoading?: boolean; // True if image is being fetched
  inStock: boolean;
  stockLevel: number;
}

export interface Cart {
  id: string;
  userEmail: string;
  planCode: string | null;
  items: CartItem[];
  itemCount: number;
  totalItems: number; // Total quantity across all items
  subtotal: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Gets or creates a cart for a user
 */
export async function getOrCreateCart(
  userEmail: string,
  planCode?: string
): Promise<{ cart: Cart | null; error: string | null }> {
  try {
    // Try to find existing active cart
    const { data: existingCarts, error: fetchError } = await supabase
      .from('shopping_carts')
      .select(`
        *,
        cart_items (
          *,
          supplement_products (
            *,
            image_fetch_status,
            image_confidence_score
          )
        )
      `)
      .eq('user_email', userEmail)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1);

    if (fetchError) {
      console.error('[Cart Service] Error fetching cart:', fetchError);
      return { cart: null, error: 'Failed to fetch cart' };
    }

    let cartData;

    if (existingCarts && existingCarts.length > 0) {
      // Use existing cart
      cartData = existingCarts[0];
      console.log(`[Cart Service] Found existing cart: ${cartData.id}`);
    } else {
      // Create new cart
      const { data: newCart, error: createError } = await supabase
        .from('shopping_carts')
        .insert({
          user_email: userEmail,
          plan_code: planCode || null,
          is_active: true,
        })
        .select()
        .single();

      if (createError || !newCart) {
        console.error('[Cart Service] Error creating cart:', createError);
        return { cart: null, error: 'Failed to create cart' };
      }

      cartData = { ...newCart, cart_items: [] };
      console.log(`[Cart Service] Created new cart: ${newCart.id}`);
    }

    // Transform to Cart type
    const cart = transformToCart(cartData);

    return { cart, error: null };
  } catch (error) {
    console.error('[Cart Service] Error:', error);
    return { cart: null, error: 'Cart service error' };
  }
}

/**
 * Adds a product to the cart
 */
export async function addToCart(
  userEmail: string,
  productId: string,
  quantity: number = 1,
  planCode?: string,
  recommendationContext?: Record<string, unknown>
): Promise<{ cart: Cart | null; error: string | null }> {
  try {
    console.log(`[Cart Service] Adding product ${productId} (qty: ${quantity}) to cart for ${userEmail}`);

    // Validate product availability
    const validation = await validateProductAvailability(productId);

    if (!validation.available) {
      return {
        cart: null,
        error: validation.reason || 'Product not available',
      };
    }

    const product = validation.product!;

    // Check if quantity requested exceeds stock
    if (quantity > product.stockLevel) {
      return {
        cart: null,
        error: `Only ${product.stockLevel} units available in stock`,
      };
    }

    // Get or create cart
    const { cart: existingCart, error: cartError } = await getOrCreateCart(userEmail, planCode);

    if (cartError || !existingCart) {
      return { cart: null, error: cartError || 'Failed to get cart' };
    }

    // Check if product already in cart
    const { data: existingItem, error: itemError } = await supabase
      .from('cart_items')
      .select('*')
      .eq('cart_id', existingCart.id)
      .eq('product_id', productId)
      .single();

    if (existingItem) {
      // Update quantity
      const newQuantity = existingItem.quantity + quantity;

      if (newQuantity > product.stockLevel) {
        return {
          cart: null,
          error: `Cannot add ${quantity} more. Only ${product.stockLevel - existingItem.quantity} additional units available`,
        };
      }

      const { error: updateError } = await supabase
        .from('cart_items')
        .update({
          quantity: newQuantity,
        })
        .eq('id', existingItem.id);

      if (updateError) {
        console.error('[Cart Service] Error updating cart item:', updateError);
        return { cart: null, error: 'Failed to update cart' };
      }

      console.log(`[Cart Service] Updated quantity to ${newQuantity}`);
    } else {
      // Add new item
      const { error: insertError } = await supabase.from('cart_items').insert({
        cart_id: existingCart.id,
        product_id: productId,
        quantity,
        unit_price: product.retailPrice,
        recommendation_context: recommendationContext || null,
      });

      if (insertError) {
        console.error('[Cart Service] Error adding cart item:', insertError);
        return { cart: null, error: 'Failed to add item to cart' };
      }

      console.log(`[Cart Service] Added new item to cart`);
    }

    // Fetch updated cart
    return getCart(userEmail);
  } catch (error) {
    console.error('[Cart Service] Error:', error);
    return { cart: null, error: 'Failed to add to cart' };
  }
}

/**
 * Updates quantity of a cart item
 */
export async function updateCartItemQuantity(
  userEmail: string,
  cartItemId: string,
  quantity: number
): Promise<{ cart: Cart | null; error: string | null }> {
  try {
    if (quantity < 1) {
      return removeFromCart(userEmail, cartItemId);
    }

    // Get cart item with product info
    const { data: cartItem, error: itemError } = await supabase
      .from('cart_items')
      .select(`
        *,
        shopping_carts (user_email),
        supplement_products (stock_level)
      `)
      .eq('id', cartItemId)
      .single();

    if (itemError || !cartItem) {
      return { cart: null, error: 'Cart item not found' };
    }

    // Verify ownership
    if (cartItem.shopping_carts.user_email !== userEmail) {
      return { cart: null, error: 'Unauthorized' };
    }

    // Check stock
    if (quantity > cartItem.supplement_products.stock_level) {
      return {
        cart: null,
        error: `Only ${cartItem.supplement_products.stock_level} units available`,
      };
    }

    // Update quantity
    const { error: updateError } = await supabase
      .from('cart_items')
      .update({ quantity })
      .eq('id', cartItemId);

    if (updateError) {
      return { cart: null, error: 'Failed to update quantity' };
    }

    console.log(`[Cart Service] Updated item ${cartItemId} quantity to ${quantity}`);

    return getCart(userEmail);
  } catch (error) {
    console.error('[Cart Service] Error:', error);
    return { cart: null, error: 'Failed to update quantity' };
  }
}

/**
 * Removes an item from the cart
 */
export async function removeFromCart(
  userEmail: string,
  cartItemId: string
): Promise<{ cart: Cart | null; error: string | null }> {
  try {
    // Verify ownership before deleting
    const { data: cartItem, error: itemError } = await supabase
      .from('cart_items')
      .select(`
        *,
        shopping_carts (user_email)
      `)
      .eq('id', cartItemId)
      .single();

    if (itemError || !cartItem) {
      return { cart: null, error: 'Cart item not found' };
    }

    if (cartItem.shopping_carts.user_email !== userEmail) {
      return { cart: null, error: 'Unauthorized' };
    }

    // Delete item
    const { error: deleteError } = await supabase
      .from('cart_items')
      .delete()
      .eq('id', cartItemId);

    if (deleteError) {
      return { cart: null, error: 'Failed to remove item' };
    }

    console.log(`[Cart Service] Removed item ${cartItemId} from cart`);

    return getCart(userEmail);
  } catch (error) {
    console.error('[Cart Service] Error:', error);
    return { cart: null, error: 'Failed to remove item' };
  }
}

/**
 * Gets the current cart for a user
 */
export async function getCart(
  userEmail: string
): Promise<{ cart: Cart | null; error: string | null }> {
  return getOrCreateCart(userEmail);
}

/**
 * Clears all items from the cart
 */
export async function clearCart(
  userEmail: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { cart, error: cartError } = await getCart(userEmail);

    if (cartError || !cart) {
      return { success: false, error: cartError || 'Cart not found' };
    }

    // Delete all cart items
    const { error: deleteError } = await supabase
      .from('cart_items')
      .delete()
      .eq('cart_id', cart.id);

    if (deleteError) {
      return { success: false, error: 'Failed to clear cart' };
    }

    console.log(`[Cart Service] Cleared cart ${cart.id}`);

    return { success: true, error: null };
  } catch (error) {
    console.error('[Cart Service] Error:', error);
    return { success: false, error: 'Failed to clear cart' };
  }
}

/**
 * Deactivates cart (typically after order is placed)
 */
export async function deactivateCart(
  cartId: string,
  orderId: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase
      .from('shopping_carts')
      .update({
        is_active: false,
        converted_to_order_id: orderId,
      })
      .eq('id', cartId);

    if (error) {
      return { success: false, error: 'Failed to deactivate cart' };
    }

    console.log(`[Cart Service] Deactivated cart ${cartId}, converted to order ${orderId}`);

    return { success: true, error: null };
  } catch (error) {
    console.error('[Cart Service] Error:', error);
    return { success: false, error: 'Failed to deactivate cart' };
  }
}

/**
 * Validates cart items before checkout
 * Checks stock availability and price changes
 */
export async function validateCart(
  userEmail: string
): Promise<{
  valid: boolean;
  issues: string[];
  cart: Cart | null;
}> {
  try {
    const { cart, error } = await getCart(userEmail);

    if (error || !cart) {
      return {
        valid: false,
        issues: [error || 'Cart not found'],
        cart: null,
      };
    }

    if (cart.items.length === 0) {
      return {
        valid: false,
        issues: ['Cart is empty'],
        cart,
      };
    }

    const issues: string[] = [];

    // Validate each item
    for (const item of cart.items) {
      // Check stock
      if (!item.inStock || item.stockLevel === 0) {
        issues.push(`${item.name} is out of stock`);
      } else if (item.quantity > item.stockLevel) {
        issues.push(`Only ${item.stockLevel} units of ${item.name} available (you have ${item.quantity})`);
      }

      // Check price changes (get current price from database)
      const { data: currentProduct } = await supabase
        .from('supplement_products')
        .select('retail_price')
        .eq('id', item.productId)
        .single();

      if (currentProduct && parseFloat(currentProduct.retail_price) !== item.unitPrice) {
        issues.push(`Price of ${item.name} has changed from $${item.unitPrice} to $${currentProduct.retail_price}`);
      }
    }

    return {
      valid: issues.length === 0,
      issues,
      cart,
    };
  } catch (error) {
    console.error('[Cart Service] Validation error:', error);
    return {
      valid: false,
      issues: ['Cart validation failed'],
      cart: null,
    };
  }
}

/**
 * Helper function to transform database cart to Cart type
 */
function transformToCart(dbCart: any): Cart {
  const items: CartItem[] = (dbCart.cart_items || []).map((item: any) => {
    const product = item.supplement_products;
    const lineTotal = item.quantity * parseFloat(item.unit_price);

    // Determine if image needs to be loaded
    const hasValidImage = product.image_url &&
                         product.image_url !== '' &&
                         product.image_url !== '/images/supplements/default.png' &&
                         !product.image_url.includes('dicebear');

    const imageUrl = hasValidImage ? product.image_url : '/images/supplements/default.svg';
    const imageLoading = !hasValidImage && product.image_fetch_status !== 'failed';

    return {
      id: item.id,
      productId: product.id,
      sku: product.sku,
      name: product.name,
      brand: product.brand,
      quantity: item.quantity,
      unitPrice: parseFloat(item.unit_price),
      lineTotal: Math.round(lineTotal * 100) / 100,
      imageUrl,
      imageLoading,
      inStock: product.stock_level > 0,
      stockLevel: product.stock_level,
    };
  });

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);

  return {
    id: dbCart.id,
    userEmail: dbCart.user_email,
    planCode: dbCart.plan_code,
    items,
    itemCount: items.length,
    totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: Math.round(subtotal * 100) / 100,
    createdAt: dbCart.created_at,
    updatedAt: dbCart.updated_at,
  };
}
