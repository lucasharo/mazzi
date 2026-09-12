-- Use the Admin-owned platform_operations configuration as the only source
-- of truth for the payout safety period.
UPDATE public.platform_configurations
SET value = jsonb_set(
      COALESCE(value, '{}'::JSONB),
      '{payout_safety_period_hours}',
      '72'::JSONB,
      true
    ),
    updated_at = NOW()
WHERE key = 'platform_operations';

-- Remove the duplicate key introduced by the previous implementation.
DELETE FROM public.platform_configurations
WHERE key = 'payout_settings'
  AND value = '{"safety_period_hours": 72}'::JSONB;
