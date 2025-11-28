# 🛒 Supplement E-Commerce - Quick Setup Guide

## ✅ What's Been Built

A **complete, production-ready supplement e-commerce system** with:
- ✅ Product catalog with AI-powered matching
- ✅ Shopping cart with floating icon
- ✅ One-click checkout with Stripe
- ✅ Slack notifications for all orders
- ✅ Order confirmation page
- ✅ Consistent pricing ($30 margin per item)
- ✅ Real-time inventory management

---

## 🚀 Quick Start (5 Steps)

### 1. Environment Setup

Add these to your `.env.local` file:

```bash
# Stripe Keys (Get from https://dashboard.stripe.com/test/apikeys)
STRIPE_SECRET_KEY=sk_test_your_key_here
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Slack Webhook (Get from https://api.slack.com/messaging/webhooks)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# E-commerce Settings
SHIPPING_FLAT_RATE=8.99
FREE_SHIPPING_THRESHOLD=75.00
TAX_RATE=0.08

# Supabase (you already have these)
NEXT_PUBLIC_SUPABASE_URL=your_url
SUPABASE_SERVICE_ROLE_KEY=your_key
```

### 2. Run Database Migrations

In Supabase Dashboard → SQL Editor, run these files in order:
1. `supabase/migrations/006_supplement_ecommerce.sql`
2. `supabase/migrations/007_unmatched_supplements_log.sql`

Or use CLI:
```bash
supabase db push
```

### 3. Install Dependencies (Already Done)

```bash
npm install stripe @stripe/stripe-js
```

### 4. Start Development Server

```bash
npm run dev
```

### 5. Test the Flow

1. Go to your Forge plan: `/forge/personalised-plan?email=test@example.com`
2. Click "Add to Cart" on any supplement
3. Click the floating cart icon 🛒
4. Click "Proceed to Checkout"
5. Fill in shipping details
6. Use Stripe test card: `4242 4242 4242 4242`
7. Complete purchase
8. Check Slack for notification! 🎉

---

## 🎯 User Flow (Simple 1-Click Buy)

```
1. User views their fitness plan
   ↓
2. Sees AI-recommended supplements with products & prices
   ↓
3. Clicks "Add to Cart" (instant add, no modal)
   ↓
4. Cart icon shows item count
   ↓
5. Clicks cart icon → Quick cart preview
   ↓
6. Clicks "Proceed to Checkout"
   ↓
7. Single page with:
   - Order summary
   - Shipping address form
   - Payment (Stripe Elements)
   - One "Pay $XX" button
   ↓
8. Order confirmed → Slack notification sent
   ↓
9. Confirmation page with order details
```

**Total clicks to purchase: 3-4 clicks** ✨

---

## 📱 What the User Sees

### On Plan Page (Supplement Section)
```
┌─────────────────────────────────────────┐
│ 💊 Vitamin D3                           │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ NOW Foods Vitamin D3                │ │
│ │ 240 softgels • 5000 IU              │ │
│ │                                     │ │
│ │ $45.00        ✓ In Stock           │ │
│ │ $0.19/day                           │ │
│ │                                     │ │
│ │ [Add to Cart - $45.00]             │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Dosage: 1 softgel daily                │
│ Timing: Morning with food               │
│ Why: Supporting immune health...        │
└─────────────────────────────────────────┘
```

### Floating Cart (Bottom Right)
```
   🛒
    3  ← Item count badge
```

### Cart Drawer
```
┌────────────────────────────────┐
│ Your Cart (3)              [×] │
├────────────────────────────────┤
│ NOW Foods Vitamin D3           │
│ $45.00                         │
│ [-] 1 [+]  Remove  $45.00     │
│                                │
│ NOW Foods Creatine             │
│ $48.00                         │
│ [-] 2 [+]  Remove  $96.00     │
├────────────────────────────────┤
│ Subtotal          $141.00      │
│ 🎉 Free shipping!              │
│                                │
│ [Proceed to Checkout]          │
└────────────────────────────────┘
```

### Checkout Page
```
┌──────────────────────────────┐
│ Order Summary                │
│ 2x NOW Foods Vitamin D3      │
│ 1x NOW Foods Creatine        │
│                              │
│ Subtotal:  $141.00          │
│ Shipping:  FREE             │
│ Tax:       $11.28           │
│ Total:     $152.28          │
└──────────────────────────────┘

┌──────────────────────────────┐
│ Shipping Address             │
│ [Full Name]                  │
│ [Address Line 1]             │
│ [City] [State] [Zip]         │
│ [Phone]                      │
│ [Delivery Notes]             │
└──────────────────────────────┘

┌──────────────────────────────┐
│ Payment Details              │
│ [Stripe Payment Element]     │
└──────────────────────────────┘

[Pay $152.28]
🔒 Secure payment powered by Stripe
```

---

## 🔔 Slack Notifications

Every purchase sends a beautifully formatted Slack message:

```
🎉 New Order: ORD-20250128-0001

Customer: john@example.com        Total: $152.28
Items: 3 items (4 units)          Status: paid / pending

Order Items:
• 2x NOW Foods Vitamin D3 - $90.00
• 1x NOW Foods Creatine - $48.00

Subtotal: $141.00    Shipping: $0.00
Tax: $11.28          Total: $152.28

Shipping Address:
John Doe
123 Main St, New York, NY 10001

Order placed: Jan 28, 2025 at 3:45 PM
```

---

## 🛠️ Testing with Stripe

### Test Cards
- **Success:** `4242 4242 4242 4242`
- **3D Secure:** `4000 0027 6000 3184`
- **Decline:** `4000 0000 0000 0002`

Any future expiry date, any CVC, any ZIP code.

---

## 💰 How Pricing Works

1. **AI generates recommendation:** "Take Vitamin D3, 5000 IU daily"
2. **System matches to product:** NOW Foods Vitamin D3 5000 IU
3. **Price lookup:** Product catalog → $45.00 (always)
4. **User A sees:** $45.00
5. **User B sees:** $45.00 (2 weeks later)
6. **✅ Consistent pricing achieved!**

### Price Calculation
```
Wholesale: $15.00
Margin:    $30.00 (enforced by database)
Retail:    $45.00
Per-day:   $0.19 (calculated: $45 ÷ 240 capsules)
```

---

## 📦 Inventory Management

### Automatic Features
- ✅ Stock deducted on order creation
- ✅ Prevents overselling (validates before checkout)
- ✅ Low stock alerts (when <= reorder point)
- ✅ Transaction audit trail
- ✅ Price history tracking

### Example Transaction Flow
```
1. Order created
2. Database trigger fires
3. Inventory deducted: 500 → 498 units
4. Transaction logged:
   - Type: sale
   - Quantity: -2
   - Order: ORD-20250128-0001
5. Check if low stock:
   - Current: 498
   - Reorder point: 100
   - Status: OK ✓
```

---

## 🎨 Design Philosophy

### Simple & Fast
- Minimal clicks to purchase
- No unnecessary modals or popups
- Single-page checkout
- Instant cart updates

### Trust Signals
- Product brand and certifications displayed
- Stock availability shown
- Per-day cost calculator
- Secure payment badge
- Free shipping threshold

### Mobile-First
- Floating cart button
- Slide-out drawer (not full page)
- Touch-friendly buttons
- Responsive forms

---

## 🐛 Troubleshooting

### "Product not available yet"
→ Supplement not in catalog. Check `unmatched_supplements_log` table to see what's needed.

### Slack notification not sent
→ Check `SLACK_WEBHOOK_URL` in `.env.local`. Test webhook in Slack API dashboard.

### Payment not processing
→ Check Stripe keys. View Stripe Dashboard → Logs for errors.

### Cart not updating
→ Check browser console for API errors. Verify Supabase connection.

---

## 📊 Key Metrics to Track

### In Supabase
```sql
-- Total revenue
SELECT SUM(total_amount) FROM orders WHERE payment_status = 'paid';

-- Average order value
SELECT AVG(total_amount) FROM orders WHERE payment_status = 'paid';

-- Top products
SELECT product_name, SUM(quantity) as units_sold
FROM order_items
GROUP BY product_name
ORDER BY units_sold DESC;

-- Conversion rate (need to add cart_created tracking)
```

### In Slack
- Order notifications → Track manually or pipe to analytics
- Revenue per day/week/month
- Most common supplements ordered

---

## 🚀 Next Enhancements (Optional)

1. **Email Confirmations** - SendGrid already configured
2. **Order Tracking Page** - `/orders?email=user@example.com`
3. **Admin Dashboard** - Inventory management UI
4. **Subscription System** - Monthly auto-refill
5. **Bundle Discounts** - "Buy 3, save 15%"
6. **Product Reviews** - User ratings & testimonials
7. **Referral Program** - "Refer a friend, get $10"

---

## 📞 Support

If you encounter issues:
1. Check browser console for errors
2. Check server logs (`npm run dev` output)
3. Check Stripe Dashboard → Logs
4. Check Supabase Dashboard → Logs
5. Review this guide and `SUPPLEMENT_ECOMMERCE_GUIDE.md`

---

## 🎉 You're Ready!

Your supplement store is **fully operational**. Every purchase will:
- ✅ Deduct inventory
- ✅ Create an order
- ✅ Process payment via Stripe
- ✅ Send Slack notification
- ✅ Show confirmation to user

**Start selling supplements with AI-powered recommendations!** 💊🚀
