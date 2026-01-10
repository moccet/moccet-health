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
 * Sends onboarding email submission notification to Slack
 */
export async function notifyOnboardingEmail(
  email: string,
  product: 'Forge' | 'Sage',
  currentScreen: string,
  screenIndex: number,
  totalScreens: number,
  fullName?: string
): Promise<boolean> {
  const productEmoji = product === 'Sage' ? '🥗' : '💪';
  const progress = Math.round((screenIndex / totalScreens) * 100);

  const payload = {
    text: `${productEmoji} New ${product} Onboarding Email: ${email}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${productEmoji} New ${product} Onboarding Started`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Email:*\n${email}`,
          },
          {
            type: 'mrkdwn',
            text: `*Name:*\n${fullName || 'Not yet provided'}`,
          },
          {
            type: 'mrkdwn',
            text: `*Product:*\n${product}`,
          },
          {
            type: 'mrkdwn',
            text: `*Current Screen:*\n${currentScreen}`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Progress:* ${screenIndex + 1}/${totalScreens} screens (${progress}%)`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Email submitted: <!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} at {time}|${new Date().toISOString()}>`,
          },
        ],
      },
    ],
  };

  return sendSlackNotification(payload);
}

/**
 * Sends payment success notification to Slack
 */
export async function notifyPaymentSuccess(
  email: string,
  amount: number,
  paymentType: 'plan' | 'cart' | 'other',
  details?: {
    planType?: 'Sage' | 'Forge';
    fullName?: string;
    itemCount?: number;
    paymentIntentId?: string;
  }
): Promise<boolean> {
  let emoji = '💳';
  let title = 'New Payment Received';
  let typeLabel = 'Payment';

  if (paymentType === 'plan' && details?.planType) {
    emoji = details.planType === 'Sage' ? '🥗' : '💪';
    title = `${details.planType} Plan Payment Received`;
    typeLabel = `${details.planType} Plan`;
  } else if (paymentType === 'cart') {
    emoji = '🛒';
    title = 'Supplement Order Payment Received';
    typeLabel = 'Supplement Order';
  }

  const payload = {
    text: `${emoji} ${title}: $${amount.toFixed(2)}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} ${title}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Customer:*\n${details?.fullName || email}`,
          },
          {
            type: 'mrkdwn',
            text: `*Email:*\n${email}`,
          },
          {
            type: 'mrkdwn',
            text: `*Amount:*\n$${amount.toFixed(2)}`,
          },
          {
            type: 'mrkdwn',
            text: `*Type:*\n${typeLabel}`,
          },
        ],
      },
      ...(details?.itemCount ? [{
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Items:* ${details.itemCount} items`,
        },
      }] : []),
      ...(details?.paymentIntentId ? [{
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Payment ID: \`${details.paymentIntentId}\` | <!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} at {time}|${new Date().toISOString()}>`,
          },
        ],
      }] : [{
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Payment received: <!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} at {time}|${new Date().toISOString()}>`,
          },
        ],
      }]),
    ],
  };

  return sendSlackNotification(payload);
}

/**
 * Sends Forge onboarding completion notification to Slack
 */
export async function notifyForgeOnboardingComplete(
  email: string,
  formData: {
    fullName?: string;
    age?: string;
    gender?: string;
    primaryGoal?: string;
    trainingDays?: string;
    trainingExperience?: string;
    hasLabFile?: boolean;
    uniqueCode: string;
  }
): Promise<boolean> {
  const payload = {
    text: `💪 New Forge Plan Submission: ${email}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '💪 New Forge Plan Submission',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Name:*\n${formData.fullName || 'Not provided'}`,
          },
          {
            type: 'mrkdwn',
            text: `*Email:*\n${email}`,
          },
          {
            type: 'mrkdwn',
            text: `*Age:*\n${formData.age || 'N/A'}`,
          },
          {
            type: 'mrkdwn',
            text: `*Gender:*\n${formData.gender || 'N/A'}`,
          },
        ],
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Primary Goal:*\n${formData.primaryGoal || 'N/A'}`,
          },
          {
            type: 'mrkdwn',
            text: `*Training Days:*\n${formData.trainingDays || 'N/A'} days/week`,
          },
          {
            type: 'mrkdwn',
            text: `*Experience:*\n${formData.trainingExperience || 'N/A'}`,
          },
          {
            type: 'mrkdwn',
            text: `*Lab File:*\n${formData.hasLabFile ? '✅ Uploaded' : '❌ None'}`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Plan Code:* \`${formData.uniqueCode}\``,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Submitted: <!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} at {time}|${new Date().toISOString()}>`,
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
/**
 * Sends culture assessment completion notification to Slack
 */
export async function notifyCultureAssessmentComplete(
  data: {
    email: string;
    name?: string;
    role?: string;
    overallScore: number;
    categoryScores: Record<string, { score: number; max: number; label: string }>;
    selfRating?: number;
    managerRating?: number;
  }
): Promise<boolean> {
  const scoreEmoji = data.overallScore >= 80 ? '🌟' : data.overallScore >= 60 ? '✅' : '📋';
  const ratingGap = data.selfRating && data.managerRating
    ? data.selfRating - data.managerRating
    : null;
  const gapIndicator = ratingGap !== null
    ? (ratingGap > 2 ? '⚠️ +' + ratingGap : ratingGap < -2 ? '📉 ' + ratingGap : '✓ ' + ratingGap)
    : 'N/A';

  // Build category scores summary
  const topCategories = Object.entries(data.categoryScores)
    .map(([key, val]) => ({ label: val.label, pct: Math.round((val.score / val.max) * 100) }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 4);

  const categoryText = topCategories
    .map(c => `${c.label}: ${c.pct}%`)
    .join(' | ');

  const payload = {
    text: `${scoreEmoji} New Culture Assessment: ${data.email} (${data.overallScore}%)`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${scoreEmoji} New Culture Assessment Submission`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Name:*\n${data.name || 'Not provided'}`,
          },
          {
            type: 'mrkdwn',
            text: `*Email:*\n${data.email}`,
          },
          {
            type: 'mrkdwn',
            text: `*Role Applied:*\n${data.role || 'Not provided'}`,
          },
          {
            type: 'mrkdwn',
            text: `*Overall Score:*\n${data.overallScore}%`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Top Categories:*\n${categoryText}`,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Self Rating:*\n${data.selfRating || 'N/A'}/10`,
          },
          {
            type: 'mrkdwn',
            text: `*Manager Rating:*\n${data.managerRating || 'N/A'}/10`,
          },
          {
            type: 'mrkdwn',
            text: `*Rating Gap:*\n${gapIndicator}`,
          },
        ],
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Submitted: <!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} at {time}|${new Date().toISOString()}>`,
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
