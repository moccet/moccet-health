/**
 * Slack Notifications
 * Sends notifications to Slack for important events
 */

import { type Order } from './services/orders';

/**
 * Sends a notification to Slack
 */
async function sendSlackNotification(payload: {
  text: string;
  blocks?: any[];
}): Promise<boolean> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn('[Slack] Webhook URL not configured, skipping notification');
    return false;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error('[Slack] Notification failed:', await response.text());
      return false;
    }

    console.log('[Slack] ✅ Notification sent successfully');
    return true;
  } catch (error) {
    console.error('[Slack] Error sending notification:', error);
    return false;
  }
}

/**
 * Sends order notification to Slack
 */
export async function notifyNewOrder(order: Order): Promise<boolean> {
  const itemsList = order.items
    .map((item) => `• ${item.quantity}x ${item.productBrand} ${item.productName} - $${item.lineTotal.toFixed(2)}`)
    .join('\n');

  const shippingAddress = order.shippingAddress
    ? `${order.shippingAddress.addressLine1}, ${order.shippingAddress.city}, ${order.shippingAddress.stateProvince} ${order.shippingAddress.postalCode}`
    : 'No address';

  const payload = {
    text: `🎉 New Supplement Order: ${order.orderNumber}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `🎉 New Order: ${order.orderNumber}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Customer:*\n${order.userEmail}`,
          },
          {
            type: 'mrkdwn',
            text: `*Total:*\n$${order.total.toFixed(2)}`,
          },
          {
            type: 'mrkdwn',
            text: `*Items:*\n${order.items.length} items (${order.items.reduce((sum, i) => sum + i.quantity, 0)} units)`,
          },
          {
            type: 'mrkdwn',
            text: `*Status:*\n${order.paymentStatus} / ${order.fulfillmentStatus}`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Order Items:*\n${itemsList}`,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Subtotal:*\n$${order.subtotal.toFixed(2)}`,
          },
          {
            type: 'mrkdwn',
            text: `*Shipping:*\n$${order.shippingCost.toFixed(2)}`,
          },
          {
            type: 'mrkdwn',
            text: `*Tax:*\n$${order.taxAmount.toFixed(2)}`,
          },
          {
            type: 'mrkdwn',
            text: `*Total:*\n$${order.total.toFixed(2)}`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Shipping Address:*\n${order.shippingAddress?.fullName || 'N/A'}\n${shippingAddress}`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Order placed: <!date^${Math.floor(new Date(order.createdAt).getTime() / 1000)}^{date_short_pretty} at {time}|${order.createdAt}>`,
          },
        ],
      },
    ],
  };

  return sendSlackNotification(payload);
}

/**
 * Sends low stock alert to Slack
 */
export async function notifyLowStock(
  productName: string,
  stockLevel: number,
  reorderPoint: number
): Promise<boolean> {
  const payload = {
    text: `⚠️ Low Stock Alert: ${productName}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '⚠️ Low Stock Alert',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Product:*\n${productName}`,
          },
          {
            type: 'mrkdwn',
            text: `*Current Stock:*\n${stockLevel} units`,
          },
          {
            type: 'mrkdwn',
            text: `*Reorder Point:*\n${reorderPoint} units`,
          },
          {
            type: 'mrkdwn',
            text: `*Action Needed:*\nRestock immediately`,
          },
        ],
      },
    ],
  };

  return sendSlackNotification(payload);
}

/**
 * Sends order shipped notification to Slack
 */
export async function notifyOrderShipped(
  orderNumber: string,
  trackingNumber: string,
  carrier: string,
  customerEmail: string
): Promise<boolean> {
  const payload = {
    text: `📦 Order Shipped: ${orderNumber}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `📦 Order Shipped: ${orderNumber}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Customer:*\n${customerEmail}`,
          },
          {
            type: 'mrkdwn',
            text: `*Carrier:*\n${carrier}`,
          },
          {
            type: 'mrkdwn',
            text: `*Tracking:*\n${trackingNumber}`,
          },
        ],
      },
    ],
  };

  return sendSlackNotification(payload);
}

/**
 * Sends plan generation queued notification to Slack
 */
export async function notifyPlanQueued(
  email: string,
  planType: 'Sage' | 'Forge',
  uniqueCode: string,
  fullName?: string,
  referralCode?: string
): Promise<boolean> {
  const planEmoji = planType === 'Sage' ? '🥗' : '💪';
  const planTypeLabel = planType === 'Sage' ? 'Nutrition Plan' : 'Fitness Plan';
  const paymentStatus = referralCode
    ? `🎟️ Referral Code: \`${referralCode}\``
    : '💳 Paid';

  const payload = {
    text: `${planEmoji} ${planType} Plan Generation Queued`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${planEmoji} ${planType} Plan Queued for Generation`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*User:*\n${fullName || email}`,
          },
          {
            type: 'mrkdwn',
            text: `*Email:*\n${email}`,
          },
          {
            type: 'mrkdwn',
            text: `*Plan Type:*\n${planTypeLabel}`,
          },
          {
            type: 'mrkdwn',
            text: `*Plan Code:*\n\`${uniqueCode}\``,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Payment:* ${paymentStatus}`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Plan queued: <!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} at {time}|${new Date().toISOString()}>`,
          },
        ],
      },
    ],
  };

  return sendSlackNotification(payload);
}
