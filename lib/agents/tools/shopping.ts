/**
 * Shopping Tools
 * Tools for product search, cart management, and purchases
 */

import { z } from 'zod';
import { ToolDefinition, ToolContext, ToolResult } from './types';

// Simulated shopping cart (in production, this would be in database or external service)
const userCarts: Map<string, any[]> = new Map();

// Search for products
export const searchProductsTool: ToolDefinition = {
  name: 'search_products',
  description: `Search for health-related products from various retailers.
    Use this to find supplements, health devices, or wellness products.`,
  riskLevel: 'low',
  parameters: z.object({
    query: z.string().describe('Search query'),
    category: z.enum(['supplements', 'devices', 'fitness', 'wellness', 'all']).optional()
      .describe('Product category to search in'),
    maxPrice: z.number().optional()
      .describe('Maximum price filter'),
    sortBy: z.enum(['price_low', 'price_high', 'rating', 'relevance']).optional()
      .describe('Sort order'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const { query, category = 'all', maxPrice, sortBy = 'relevance' } = params;

      // Simulated product search (in production, this would call real APIs)
      // For now, we use the supplement database and add some mock products
      const mockProducts = [
        {
          id: 'prod_fitbit_inspire',
          name: 'Fitbit Inspire 3',
          category: 'devices',
          price: 99.95,
          rating: 4.5,
          retailer: 'Amazon',
          description: 'Health and fitness tracker with heart rate monitoring',
          url: 'https://amazon.com/fitbit-inspire-3',
        },
        {
          id: 'prod_oura_gen3',
          name: 'Oura Ring Gen 3',
          category: 'devices',
          price: 299.00,
          rating: 4.7,
          retailer: 'Oura',
          description: 'Smart ring for sleep and recovery tracking',
          url: 'https://ouraring.com/product/oura-ring-gen3',
        },
        {
          id: 'prod_vitd_thorne',
          name: 'Thorne Vitamin D3 Liquid',
          category: 'supplements',
          price: 24.99,
          rating: 4.8,
          retailer: 'Thorne',
          description: 'High-quality vitamin D3 in liquid form',
          url: 'https://www.thorne.com/products/dp/vitamin-d-liquid',
        },
        {
          id: 'prod_mag_pure',
          name: 'Pure Encapsulations Magnesium',
          category: 'supplements',
          price: 32.50,
          rating: 4.8,
          retailer: 'Pure Encapsulations',
          description: 'Magnesium glycinate for sleep and relaxation',
          url: 'https://www.pureencapsulations.com/magnesium-glycinate',
        },
        {
          id: 'prod_yoga_mat',
          name: 'Manduka PRO Yoga Mat',
          category: 'fitness',
          price: 120.00,
          rating: 4.9,
          retailer: 'Amazon',
          description: 'Professional-grade yoga mat',
          url: 'https://amazon.com/manduka-pro',
        },
        {
          id: 'prod_meditation_cushion',
          name: 'Zafu Meditation Cushion',
          category: 'wellness',
          price: 49.99,
          rating: 4.6,
          retailer: 'Amazon',
          description: 'Traditional meditation cushion for comfort',
          url: 'https://amazon.com/zafu-cushion',
        },
      ];

      // Filter products
      let results = mockProducts.filter((p) => {
        const matchesQuery =
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.description.toLowerCase().includes(query.toLowerCase());
        const matchesCategory = category === 'all' || p.category === category;
        const matchesPrice = maxPrice === undefined || p.price <= maxPrice;
        return matchesQuery && matchesCategory && matchesPrice;
      });

      // Sort results
      switch (sortBy) {
        case 'price_low':
          results.sort((a, b) => a.price - b.price);
          break;
        case 'price_high':
          results.sort((a, b) => b.price - a.price);
          break;
        case 'rating':
          results.sort((a, b) => b.rating - a.rating);
          break;
        default:
          // relevance - keep original order
          break;
      }

      return {
        success: true,
        data: {
          products: results,
          totalFound: results.length,
          searchCriteria: {
            query,
            category,
            maxPrice,
            sortBy,
          },
        },
        metadata: {
          source: 'product_search',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to search products: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

// Add item to cart
export const addToCartTool: ToolDefinition = {
  name: 'add_to_cart',
  description: `Add a product to the user's shopping cart.
    MEDIUM RISK: This prepares for a purchase - requires approval.
    Use after finding a product the user wants to buy.`,
  riskLevel: 'medium',
  parameters: z.object({
    productId: z.string().describe('ID of the product to add'),
    productName: z.string().describe('Name of the product'),
    price: z.number().describe('Price of the product'),
    quantity: z.number().min(1).max(10).optional()
      .describe('Quantity to add. Default is 1.'),
    retailer: z.string().optional().describe('Retailer name'),
    url: z.string().optional().describe('Product URL'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const { productId, productName, price, quantity = 1, retailer, url } = params;

      // Get or create cart
      const cart = userCarts.get(context.userEmail) || [];

      // Check if item already in cart
      const existingIndex = cart.findIndex((item) => item.productId === productId);

      if (existingIndex >= 0) {
        cart[existingIndex].quantity += quantity;
      } else {
        cart.push({
          productId,
          productName,
          price,
          quantity,
          retailer,
          url,
          addedAt: new Date().toISOString(),
        });
      }

      userCarts.set(context.userEmail, cart);

      // Also save to database for persistence
      await context.supabase.from('user_shopping_cart').upsert({
        user_email: context.userEmail,
        cart_items: cart,
        updated_at: new Date().toISOString(),
      });

      // Log the action
      await context.supabase.from('agent_action_log').insert({
        user_email: context.userEmail,
        action_type: 'product_added_to_cart',
        details: {
          productId,
          productName,
          price,
          quantity,
        },
      });

      const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

      return {
        success: true,
        data: {
          addedItem: {
            productId,
            productName,
            price,
            quantity,
          },
          cartSummary: {
            totalItems: cart.reduce((sum, item) => sum + item.quantity, 0),
            totalPrice: cartTotal,
            items: cart,
          },
        },
        metadata: {
          source: 'shopping_cart',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to add to cart: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

// Get cart contents
export const getCartTool: ToolDefinition = {
  name: 'get_cart',
  description: `Get the contents of the user's shopping cart.`,
  riskLevel: 'low',
  parameters: z.object({}),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      // Try to get from database first
      const { data: cartData } = await context.supabase
        .from('user_shopping_cart')
        .select('cart_items')
        .eq('user_email', context.userEmail)
        .maybeSingle();

      const cart = cartData?.cart_items || userCarts.get(context.userEmail) || [];
      const cartTotal = cart.reduce(
        (sum: number, item: any) => sum + item.price * item.quantity,
        0
      );

      return {
        success: true,
        data: {
          items: cart,
          totalItems: cart.reduce((sum: number, item: any) => sum + item.quantity, 0),
          totalPrice: cartTotal,
          isEmpty: cart.length === 0,
        },
        metadata: {
          source: 'shopping_cart',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get cart: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

// Complete purchase
export const completePurchaseTool: ToolDefinition = {
  name: 'complete_purchase',
  description: `Complete the purchase of items in the cart.
    HIGH RISK: This costs real money - requires explicit user approval.
    Only use when user has confirmed they want to buy.`,
  riskLevel: 'high',
  parameters: z.object({
    confirmPurchase: z.literal(true)
      .describe('Must be true to confirm the purchase'),
    useStoredPayment: z.boolean().optional()
      .describe('Whether to use stored payment method'),
    shippingAddressId: z.string().optional()
      .describe('ID of shipping address to use'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const { confirmPurchase, useStoredPayment = true } = params;

      if (!confirmPurchase) {
        return {
          success: false,
          error: 'Purchase not confirmed. Set confirmPurchase to true to proceed.',
        };
      }

      // Get cart
      const { data: cartData } = await context.supabase
        .from('user_shopping_cart')
        .select('cart_items')
        .eq('user_email', context.userEmail)
        .maybeSingle();

      const cart = cartData?.cart_items || [];

      if (cart.length === 0) {
        return {
          success: false,
          error: 'Cart is empty. Nothing to purchase.',
        };
      }

      const orderTotal = cart.reduce(
        (sum: number, item: any) => sum + item.price * item.quantity,
        0
      );

      // In production, this would:
      // 1. Call payment processor (Stripe)
      // 2. Create orders with retailers
      // 3. Send confirmation emails

      // For now, simulate order creation
      const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Save order to database
      await context.supabase.from('user_orders').insert({
        id: orderId,
        user_email: context.userEmail,
        items: cart,
        total: orderTotal,
        status: 'pending',
        created_at: new Date().toISOString(),
      });

      // Clear cart
      await context.supabase
        .from('user_shopping_cart')
        .delete()
        .eq('user_email', context.userEmail);
      userCarts.delete(context.userEmail);

      // Log the action
      await context.supabase.from('agent_action_log').insert({
        user_email: context.userEmail,
        action_type: 'purchase_completed',
        details: {
          orderId,
          total: orderTotal,
          itemCount: cart.length,
        },
      });

      return {
        success: true,
        data: {
          orderId,
          orderTotal,
          itemsPurchased: cart.length,
          status: 'Order placed successfully',
          estimatedDelivery: '3-5 business days',
          confirmationSent: true,
        },
        metadata: {
          source: 'purchase_system',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to complete purchase: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

export const shoppingTools = [
  searchProductsTool,
  addToCartTool,
  getCartTool,
  completePurchaseTool,
];
