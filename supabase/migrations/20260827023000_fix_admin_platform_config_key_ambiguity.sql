-- Keep the existing transactional settings contract while removing the only
-- ambiguous identifier: the JSON object key is now explicitly named json_key.
CREATE OR REPLACE FUNCTION public.update_admin_platform_configurations(p_updates jsonb)
RETURNS TABLE (key varchar(100), value jsonb)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_uid uuid;
  v_before jsonb;
  v_after jsonb;
  v_item record;
  v_allowed_keys CONSTANT text[] := ARRAY[
    'platformFeeDefaultPercentage', 'availabilityHorizonDays', 'quoteExpirationMinutes',
    'minimumBookingNoticeHours', 'payoutSafetyPeriodHours', 'searchRadiusDefaultsKm'
  ];
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  IF NOT public.current_user_has_permission('admin.platform.manage_settings'::public.app_permission) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF p_updates IS NULL OR jsonb_typeof(p_updates) <> 'object' OR p_updates = '{}'::jsonb THEN
    RAISE EXCEPTION 'INVALID_PLATFORM_CONFIG_UPDATES' USING ERRCODE = '22023';
  END IF;

  FOR v_item IN SELECT item.json_key FROM jsonb_object_keys(p_updates) AS item(json_key)
  LOOP
    IF NOT (v_item.json_key = ANY(v_allowed_keys)) THEN
      RAISE EXCEPTION 'UNSUPPORTED_PLATFORM_CONFIG_KEY: %', v_item.json_key USING ERRCODE = '22023';
    END IF;
    IF jsonb_typeof(p_updates -> v_item.json_key) <> 'number' THEN
      RAISE EXCEPTION 'PLATFORM_CONFIG_VALUE_MUST_BE_NUMBER: %', v_item.json_key USING ERRCODE = '22023';
    END IF;
  END LOOP;

  IF p_updates ? 'platformFeeDefaultPercentage' AND ((p_updates ->> 'platformFeeDefaultPercentage')::numeric < 0 OR (p_updates ->> 'platformFeeDefaultPercentage')::numeric > 100) THEN RAISE EXCEPTION 'INVALID_FEE_PERCENTAGE' USING ERRCODE = '22023'; END IF;
  IF p_updates ? 'availabilityHorizonDays' AND ((p_updates ->> 'availabilityHorizonDays')::numeric < 1 OR (p_updates ->> 'availabilityHorizonDays')::numeric > 365) THEN RAISE EXCEPTION 'INVALID_AVAILABILITY_HORIZON' USING ERRCODE = '22023'; END IF;
  IF p_updates ? 'quoteExpirationMinutes' AND (p_updates ->> 'quoteExpirationMinutes')::numeric <= 0 THEN RAISE EXCEPTION 'INVALID_QUOTE_EXPIRATION' USING ERRCODE = '22023'; END IF;
  IF p_updates ? 'minimumBookingNoticeHours' AND (p_updates ->> 'minimumBookingNoticeHours')::numeric < 0 THEN RAISE EXCEPTION 'INVALID_MINIMUM_BOOKING_NOTICE' USING ERRCODE = '22023'; END IF;
  IF p_updates ? 'payoutSafetyPeriodHours' AND (p_updates ->> 'payoutSafetyPeriodHours')::numeric < 0 THEN RAISE EXCEPTION 'INVALID_PAYOUT_SAFETY_PERIOD' USING ERRCODE = '22023'; END IF;
  IF p_updates ? 'searchRadiusDefaultsKm' AND (p_updates ->> 'searchRadiusDefaultsKm')::numeric <= 0 THEN RAISE EXCEPTION 'INVALID_SEARCH_RADIUS' USING ERRCODE = '22023'; END IF;

  SELECT coalesce(jsonb_object_agg(pc.key, pc.value), '{}'::jsonb) INTO v_before FROM public.platform_configurations pc WHERE pc.key IN ('platform_fees', 'quote_settings', 'scheduling_settings', 'platform_operations');

  IF p_updates ? 'platformFeeDefaultPercentage' THEN
    INSERT INTO public.platform_configurations (key, value, updated_by, updated_at) VALUES ('platform_fees', jsonb_build_object('default_percentage', p_updates -> 'platformFeeDefaultPercentage'), v_uid, now())
    ON CONFLICT (key) DO UPDATE SET value = jsonb_set(public.platform_configurations.value, '{default_percentage}', excluded.value -> 'default_percentage', true), updated_by = v_uid, updated_at = now();
  END IF;
  IF p_updates ? 'quoteExpirationMinutes' THEN
    INSERT INTO public.platform_configurations (key, value, updated_by, updated_at) VALUES ('quote_settings', jsonb_build_object('expiration_minutes', p_updates -> 'quoteExpirationMinutes'), v_uid, now())
    ON CONFLICT (key) DO UPDATE SET value = jsonb_set(public.platform_configurations.value, '{expiration_minutes}', excluded.value -> 'expiration_minutes', true), updated_by = v_uid, updated_at = now();
  END IF;
  IF p_updates ? 'availabilityHorizonDays' THEN
    INSERT INTO public.platform_configurations (key, value, updated_by, updated_at) VALUES ('scheduling_settings', jsonb_build_object('max_booking_horizon_days', p_updates -> 'availabilityHorizonDays'), v_uid, now())
    ON CONFLICT (key) DO UPDATE SET value = jsonb_set(public.platform_configurations.value, '{max_booking_horizon_days}', excluded.value -> 'max_booking_horizon_days', true), updated_by = v_uid, updated_at = now();
  END IF;
  IF p_updates ? 'minimumBookingNoticeHours' OR p_updates ? 'payoutSafetyPeriodHours' OR p_updates ? 'searchRadiusDefaultsKm' THEN
    INSERT INTO public.platform_configurations (key, value, updated_by, updated_at) VALUES ('platform_operations', jsonb_build_object('minimum_notice_hours', p_updates -> 'minimumBookingNoticeHours', 'payout_safety_period_hours', p_updates -> 'payoutSafetyPeriodHours', 'search_radius_km', p_updates -> 'searchRadiusDefaultsKm'), v_uid, now())
    ON CONFLICT (key) DO UPDATE SET value = public.platform_configurations.value || excluded.value, updated_by = v_uid, updated_at = now();
  END IF;

  SELECT coalesce(jsonb_object_agg(pc.key, pc.value), '{}'::jsonb) INTO v_after FROM public.platform_configurations pc WHERE pc.key IN ('platform_fees', 'quote_settings', 'scheduling_settings', 'platform_operations');
  INSERT INTO public.audit_logs (id, actor_id, action, entity_type, entity_id, previous_value, new_value, created_at) VALUES (gen_random_uuid(), v_uid, 'PLATFORM_CONFIG_UPDATED', 'PlatformConfiguration', 'platform_configurations', v_before, v_after, now());
  RETURN QUERY SELECT pc.key, pc.value FROM public.platform_configurations pc WHERE pc.key IN ('platform_fees', 'quote_settings', 'scheduling_settings', 'platform_operations') ORDER BY pc.key;
END;
$$;

REVOKE ALL ON FUNCTION public.update_admin_platform_configurations(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_admin_platform_configurations(jsonb) TO authenticated;
