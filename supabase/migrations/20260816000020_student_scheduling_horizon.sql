-- Align the server booking horizon with the Student App's progressive calendar.
-- Each RPC request remains limited to 31 days by get_available_slots_public.
UPDATE public.platform_configurations
SET value = jsonb_set(COALESCE(value, '{}'::jsonb), '{max_booking_horizon_days}', '90'::jsonb),
    updated_at = now()
WHERE key = 'scheduling_settings';

INSERT INTO public.platform_configurations (key, value, updated_at)
SELECT 'scheduling_settings', jsonb_build_object(
  'slot_interval_minutes', 60,
  'max_booking_horizon_days', 90
), now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.platform_configurations WHERE key = 'scheduling_settings'
);
