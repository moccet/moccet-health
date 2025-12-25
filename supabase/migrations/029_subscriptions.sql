-- User Subscriptions Table
-- Stores subscription information synced from Stripe

CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL UNIQUE,
    tier TEXT NOT NULL DEFAULT 'free', -- 'free', 'pro', 'max'
    status TEXT NOT NULL DEFAULT 'free', -- 'active', 'canceled', 'past_due', 'free'
    stripe_subscription_id TEXT,
    stripe_customer_id TEXT,
    stripe_price_id TEXT,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_email ON user_subscriptions(user_email);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_id ON user_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);

-- Enable RLS
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own subscription" ON user_subscriptions
    FOR SELECT USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Service role full access to subscriptions" ON user_subscriptions
    FOR ALL USING (auth.role() = 'service_role');

-- Function to check if user has active subscription
CREATE OR REPLACE FUNCTION check_subscription_tier(user_email_param TEXT)
RETURNS TEXT AS $$
DECLARE
    user_tier TEXT;
BEGIN
    SELECT tier INTO user_tier
    FROM user_subscriptions
    WHERE user_email = user_email_param
    AND status = 'active'
    AND (current_period_end IS NULL OR current_period_end > NOW());

    RETURN COALESCE(user_tier, 'free');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can access a feature
CREATE OR REPLACE FUNCTION can_access_feature(user_email_param TEXT, feature_param TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    user_tier TEXT;
    tier_order TEXT[] := ARRAY['free', 'pro', 'max'];
    user_tier_index INT;
    required_tier_index INT;
    feature_tier TEXT;
BEGIN
    -- Get user's tier
    user_tier := check_subscription_tier(user_email_param);
    user_tier_index := array_position(tier_order, user_tier);

    -- Define feature tiers
    feature_tier := CASE feature_param
        WHEN 'basic_insights' THEN 'free'
        WHEN 'data_sync' THEN 'free'
        WHEN 'unlimited_ai' THEN 'pro'
        WHEN 'agents' THEN 'pro'
        WHEN 'email_agent' THEN 'pro'
        WHEN 'voice_assistant' THEN 'pro'
        WHEN 'unlimited_insights' THEN 'max'
        WHEN 'api_access' THEN 'max'
        WHEN 'priority_support' THEN 'max'
        ELSE 'free'
    END;

    required_tier_index := array_position(tier_order, feature_tier);

    RETURN user_tier_index >= required_tier_index;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
