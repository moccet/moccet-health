import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { BrowserController } from '@/lib/services/shopping-agent/browser-controller';
import {
  decryptSiteCredentials,
  decryptPaymentCard,
} from '@/lib/services/shopping-agent/encryption-service';
import type { ShippingAddress, PaymentCardInfo } from '@/lib/services/shopping-agent/sites/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * POST - Execute a shopping task (search, add to cart, checkout)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, taskId, action } = body;

    if (!email || !taskId) {
      return NextResponse.json({ error: 'Email and taskId are required' }, { status: 400 });
    }

    // Fetch task
    const { data: task, error: fetchError } = await supabase
      .from('shopping_agent_tasks')
      .select('*')
      .eq('id', taskId)
      .eq('user_email', email)
      .single();

    if (fetchError || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Determine action based on task status or explicit action
    const taskAction = action || determineNextAction(task.status);

    console.log(`[Shopping Agent] Executing action '${taskAction}' for task ${taskId}`);

    switch (taskAction) {
      case 'search':
        return executeSearch(email, task);

      case 'add_to_cart':
        return executeAddToCart(email, task);

      case 'checkout':
        return executeCheckout(email, task);

      case 'handle_2fa':
        const { twoFACode } = body;
        if (!twoFACode) {
          return NextResponse.json({ error: '2FA code is required' }, { status: 400 });
        }
        return handle2FA(email, task, twoFACode);

      default:
        return NextResponse.json(
          { error: `Cannot execute action '${taskAction}' for status '${task.status}'` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Shopping Agent] Error in execute:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Determine next action based on task status
 */
function determineNextAction(status: string): string | null {
  switch (status) {
    case 'pending':
      return 'search';
    case 'adding_to_cart':
      return 'add_to_cart';
    case 'checking_out':
    case 'processing_payment':
      return 'checkout';
    case 'awaiting_2fa':
      return 'handle_2fa';
    default:
      return null;
  }
}

/**
 * Execute product search
 */
async function executeSearch(email: string, task: any) {
  const browserController = new BrowserController({ headless: true });

  try {
    await updateTaskStatus(task.id, 'searching');

    const searchResults: any = {};

    // Search on target site
    for (const product of task.products) {
      const query = buildSearchQuery(product);
      const results = await browserController.searchProducts(task.target_site, query, {
        maxResults: 5,
        inStockOnly: true,
      });

      searchResults[product.name] = results;
    }

    // Update task with results
    await supabase
      .from('shopping_agent_tasks')
      .update({
        status: 'awaiting_approval',
        search_results: searchResults,
        search_completed_at: new Date().toISOString(),
        execution_log: appendLog(task.execution_log, 'search_completed', {
          productCount: task.products.length,
          resultsCount: Object.values(searchResults).flat().length,
        }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', task.id);

    return NextResponse.json({
      success: true,
      taskId: task.id,
      status: 'awaiting_approval',
      searchResults,
      message: 'Search completed. Awaiting product approval.',
    });
  } catch (error: any) {
    await updateTaskError(task.id, 'search_failed', error.message);
    throw error;
  } finally {
    await browserController.close();
  }
}

/**
 * Execute add to cart
 */
async function executeAddToCart(email: string, task: any) {
  if (!task.selected_products || task.selected_products.length === 0) {
    return NextResponse.json(
      { error: 'No products selected. Approve products first.' },
      { status: 400 }
    );
  }

  const browserController = new BrowserController({ headless: true });

  try {
    await updateTaskStatus(task.id, 'adding_to_cart');

    // Load session if available
    const { data: siteCredentials } = await supabase
      .from('external_site_credentials')
      .select('last_session_cookies_encrypted')
      .eq('user_email', email)
      .eq('site_name', task.target_site)
      .single();

    if (siteCredentials?.last_session_cookies_encrypted) {
      await browserController.loadSession(
        task.target_site,
        siteCredentials.last_session_cookies_encrypted
      );
    }

    // Add each product to cart
    const cartResults = [];
    for (const product of task.selected_products) {
      const success = await browserController.addToCart(
        task.target_site,
        product.url,
        product.quantity || 1
      );
      cartResults.push({ product: product.name, success });
    }

    // Verify cart contents
    const cart = await browserController.getCartContents(task.target_site);

    // Save session for later
    const sessionCookies = await browserController.saveSession(task.target_site);
    if (sessionCookies) {
      await supabase
        .from('external_site_credentials')
        .update({
          last_session_cookies_encrypted: sessionCookies,
          updated_at: new Date().toISOString(),
        })
        .eq('user_email', email)
        .eq('site_name', task.target_site);
    }

    // Update task
    await supabase
      .from('shopping_agent_tasks')
      .update({
        status: 'verifying_cart',
        cart_snapshot: cart,
        cart_verified_at: new Date().toISOString(),
        execution_log: appendLog(task.execution_log, 'cart_updated', {
          itemsAdded: cartResults.filter(r => r.success).length,
          cartTotal: cart.total,
        }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', task.id);

    return NextResponse.json({
      success: true,
      taskId: task.id,
      status: 'verifying_cart',
      cart,
      cartResults,
      message: 'Items added to cart. Ready for checkout.',
    });
  } catch (error: any) {
    await updateTaskError(task.id, 'cart_failed', error.message);
    throw error;
  } finally {
    await browserController.close();
  }
}

/**
 * Execute checkout
 */
async function executeCheckout(email: string, task: any) {
  // Get credentials and payment info
  const { data: siteCredentials } = await supabase
    .from('external_site_credentials')
    .select('*')
    .eq('user_email', email)
    .eq('site_name', task.target_site)
    .single();

  if (!siteCredentials) {
    return NextResponse.json(
      { error: `No credentials stored for ${task.target_site}. Please add your login.` },
      { status: 400 }
    );
  }

  const { data: paymentMethod } = await supabase
    .from('user_payment_credentials')
    .select('*')
    .eq('user_email', email)
    .eq('is_default', true)
    .eq('is_active', true)
    .single();

  if (!paymentMethod) {
    return NextResponse.json(
      { error: 'No payment method stored. Please add a payment card.' },
      { status: 400 }
    );
  }

  const { data: shippingAddress } = await supabase
    .from('user_addresses')
    .select('*')
    .eq('user_email', email)
    .eq('is_default', true)
    .single();

  if (!shippingAddress) {
    return NextResponse.json(
      { error: 'No shipping address stored. Please add an address.' },
      { status: 400 }
    );
  }

  const browserController = new BrowserController({ headless: true });

  try {
    await updateTaskStatus(task.id, 'checking_out');

    // Decrypt credentials
    const decryptedCreds = decryptSiteCredentials({
      encryptedEmail: siteCredentials.encrypted_email,
      encryptedPassword: siteCredentials.encrypted_password,
      keyId: siteCredentials.encryption_key_id,
      version: siteCredentials.encryption_version,
    });

    const decryptedCard = decryptPaymentCard({
      encryptedCardNumber: paymentMethod.encrypted_card_number,
      encryptedExpiry: paymentMethod.encrypted_expiry,
      encryptedCvv: paymentMethod.encrypted_cvv,
      cardLastFour: paymentMethod.card_last_four,
      cardBrand: paymentMethod.card_brand,
      keyId: paymentMethod.encryption_key_id,
      version: paymentMethod.encryption_version,
    });

    // Login first
    const loginResult = await browserController.login(
      task.target_site,
      decryptedCreds.email,
      decryptedCreds.password
    );

    if (!loginResult.success) {
      if (loginResult.requires2FA) {
        await supabase
          .from('shopping_agent_tasks')
          .update({
            status: 'awaiting_2fa',
            error_type: '2fa_required',
            error_details: { method: loginResult.twoFAMethod },
            updated_at: new Date().toISOString(),
          })
          .eq('id', task.id);

        return NextResponse.json({
          success: false,
          taskId: task.id,
          status: 'awaiting_2fa',
          twoFAMethod: loginResult.twoFAMethod,
          message: `2FA required. Please provide the ${loginResult.twoFAMethod} code.`,
        });
      }

      await updateTaskError(task.id, 'login_failed', loginResult.error || 'Login failed');
      return NextResponse.json({
        success: false,
        error: loginResult.error || 'Login failed',
      });
    }

    // Build checkout params
    const checkoutParams = {
      site: task.target_site,
      email,
      shippingAddress: {
        fullName: shippingAddress.full_name,
        addressLine1: shippingAddress.address_line_1,
        addressLine2: shippingAddress.address_line_2,
        city: shippingAddress.city,
        state: shippingAddress.state,
        postalCode: shippingAddress.postal_code,
        country: shippingAddress.country,
        phone: shippingAddress.phone,
      } as ShippingAddress,
      paymentCard: {
        cardNumber: decryptedCard.cardNumber,
        expiry: decryptedCard.expiry,
        cvv: decryptedCard.cvv,
        cardholderName: paymentMethod.cardholder_name,
      } as PaymentCardInfo,
      items: task.selected_products,
      expectedTotal: task.approved_total,
    };

    // Execute checkout
    await updateTaskStatus(task.id, 'processing_payment');
    const checkoutResult = await browserController.executeCheckout(checkoutParams);

    if (checkoutResult.success) {
      // Record successful purchase
      await supabase
        .from('shopping_agent_tasks')
        .update({
          status: 'completed',
          order_confirmation_number: checkoutResult.orderNumber,
          order_confirmation_url: checkoutResult.orderUrl,
          total_spent: checkoutResult.total,
          checkout_completed_at: new Date().toISOString(),
          execution_log: appendLog(task.execution_log, 'checkout_completed', {
            orderNumber: checkoutResult.orderNumber,
            total: checkoutResult.total,
          }),
          updated_at: new Date().toISOString(),
        })
        .eq('id', task.id);

      // Add to purchase history
      await supabase
        .from('external_purchase_history')
        .insert({
          user_email: email,
          shopping_task_id: task.id,
          site_name: task.target_site,
          order_number: checkoutResult.orderNumber || 'unknown',
          items: task.selected_products,
          total: checkoutResult.total,
          order_status: 'placed',
          estimated_delivery: checkoutResult.estimatedDelivery
            ? new Date(checkoutResult.estimatedDelivery).toISOString()
            : null,
        });

      return NextResponse.json({
        success: true,
        taskId: task.id,
        status: 'completed',
        orderNumber: checkoutResult.orderNumber,
        orderUrl: checkoutResult.orderUrl,
        total: checkoutResult.total,
        message: 'Purchase completed successfully!',
      });
    }

    // Handle checkout errors
    await updateTaskError(task.id, checkoutResult.errorType || 'checkout_failed', checkoutResult.error);

    return NextResponse.json({
      success: false,
      taskId: task.id,
      error: checkoutResult.error,
      errorType: checkoutResult.errorType,
    });
  } catch (error: any) {
    await updateTaskError(task.id, 'checkout_failed', error.message);
    throw error;
  } finally {
    await browserController.close();
  }
}

/**
 * Handle 2FA verification
 */
async function handle2FA(email: string, task: any, twoFACode: string) {
  const browserController = new BrowserController({ headless: true });

  try {
    const method = task.error_details?.method || 'totp';
    const result = await browserController.handle2FA(task.target_site, twoFACode, method);

    if (result.success) {
      // 2FA successful, continue with checkout
      await supabase
        .from('shopping_agent_tasks')
        .update({
          status: 'checking_out',
          error_type: null,
          error_details: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', task.id);

      // Recursively call checkout
      return executeCheckout(email, { ...task, status: 'checking_out' });
    }

    await updateTaskError(task.id, '2fa_failed', result.error || '2FA verification failed');
    return NextResponse.json({
      success: false,
      error: result.error || '2FA verification failed',
    });
  } finally {
    await browserController.close();
  }
}

// Helper functions

async function updateTaskStatus(taskId: string, status: string) {
  await supabase
    .from('shopping_agent_tasks')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', taskId);
}

async function updateTaskError(taskId: string, errorType: string, errorMessage: string) {
  await supabase
    .from('shopping_agent_tasks')
    .update({
      status: 'failed',
      error_type: errorType,
      error_details: { message: errorMessage, timestamp: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId);
}

function appendLog(existingLog: any[] | null, action: string, details: any): any[] {
  const log = existingLog || [];
  log.push({
    timestamp: new Date().toISOString(),
    action,
    ...details,
  });
  return log;
}

function buildSearchQuery(product: any): string {
  const parts = [product.name];
  if (product.dosage) parts.push(product.dosage);
  if (product.brand) parts.unshift(product.brand);
  return parts.join(' ');
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
