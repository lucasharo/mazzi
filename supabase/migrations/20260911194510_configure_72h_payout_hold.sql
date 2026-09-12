-- DEV configuration: keep the MAZZI safety period at 72 hours.
-- The payment service remains responsible for the external bank payout.
UPDATE public.platform_configurations
SET value = jsonb_set(COALESCE(value, '{}'::JSONB), '{safety_period_hours}', '72'::JSONB),
    updated_at = NOW()
WHERE key = 'payout_settings';
