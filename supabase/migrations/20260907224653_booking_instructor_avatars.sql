-- MAZZI — Make the instructor avatar available in the student's booking context.
-- This covers both scheduled bookings and Aula Agora, including legacy bookings
-- whose snapshot was created before avatar data was stored.

CREATE OR REPLACE FUNCTION public.get_my_booking_avatars(p_booking_ids UUID[])
RETURNS TABLE (
  booking_id UUID,
  instructor_avatar_url TEXT,
  provider_avatar_url TEXT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    b.id,
    NULLIF(BTRIM(iu.avatar_url), '')::TEXT,
    NULLIF(BTRIM(p.avatar_url), '')::TEXT
  FROM public.bookings b
  LEFT JOIN public.users iu ON iu.id = b.instructor_id AND iu.status = 'ACTIVE'
  LEFT JOIN public.providers p ON p.id = b.provider_id
  WHERE auth.uid() IS NOT NULL
    AND b.student_id = auth.uid()
    AND p_booking_ids IS NOT NULL
    AND cardinality(p_booking_ids) > 0
    AND b.id = ANY(p_booking_ids);
$$;

REVOKE ALL ON FUNCTION public.get_my_booking_avatars(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_booking_avatars(UUID[]) TO authenticated;

-- Keep the avatar in the booking snapshot as a fallback for clients that are
-- temporarily using an older PostgREST schema cache.
CREATE OR REPLACE FUNCTION public.normalize_booking_snapshot_names()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_instructor_name TEXT;
  v_instructor_avatar_url TEXT;
  v_provider_name TEXT;
  v_provider_avatar_url TEXT;
  v_vehicle_name TEXT;
  v_meeting_point TEXT;
BEGIN
  SELECT u.name, NULLIF(BTRIM(u.avatar_url), '')
    INTO v_instructor_name, v_instructor_avatar_url
    FROM public.users u WHERE u.id = NEW.instructor_id;
  SELECT p.trade_name, NULLIF(BTRIM(p.avatar_url), ''), COALESCE(p.neighborhood, p.city)
    INTO v_provider_name, v_provider_avatar_url, v_meeting_point
    FROM public.providers p WHERE p.id = NEW.provider_id;
  SELECT CONCAT(v.brand, ' ', v.model) INTO v_vehicle_name
    FROM public.vehicles v WHERE v.id = NEW.vehicle_id;

  NEW.snapshot_data := jsonb_set(COALESCE(NEW.snapshot_data, '{}'::JSONB), '{instructorName}', TO_JSONB(COALESCE(v_instructor_name, '')), TRUE);
  NEW.snapshot_data := jsonb_set(NEW.snapshot_data, '{providerName}', TO_JSONB(COALESCE(v_provider_name, '')), TRUE);
  NEW.snapshot_data := jsonb_set(NEW.snapshot_data, '{vehicleName}', TO_JSONB(COALESCE(v_vehicle_name, '')), TRUE);
  NEW.snapshot_data := jsonb_set(NEW.snapshot_data, '{meetingPoint}', TO_JSONB(COALESCE(v_meeting_point, '')), TRUE);

  IF v_instructor_avatar_url IS NULL THEN
    NEW.snapshot_data := NEW.snapshot_data - 'instructorAvatarUrl' - 'instructor_avatar_url';
  ELSE
    NEW.snapshot_data := jsonb_set(NEW.snapshot_data, '{instructorAvatarUrl}', TO_JSONB(v_instructor_avatar_url), TRUE);
  END IF;
  IF v_provider_avatar_url IS NULL THEN
    NEW.snapshot_data := NEW.snapshot_data - 'providerAvatarUrl' - 'provider_avatar_url';
  ELSE
    NEW.snapshot_data := jsonb_set(NEW.snapshot_data, '{providerAvatarUrl}', TO_JSONB(v_provider_avatar_url), TRUE);
  END IF;

  RETURN NEW;
END;
$$;

-- Backfill current and historical bookings so evaluation opened from either
-- Agenda or Aula Agora works immediately, without recreating the booking.
UPDATE public.bookings b
SET snapshot_data = b.snapshot_data
  || jsonb_strip_nulls(jsonb_build_object(
    'instructorAvatarUrl', NULLIF(BTRIM(iu.avatar_url), ''),
    'providerAvatarUrl', NULLIF(BTRIM(p.avatar_url), '')
  ))
FROM public.users iu, public.providers p
WHERE iu.id = b.instructor_id
  AND p.id = b.provider_id
  AND (
    NULLIF(BTRIM(iu.avatar_url), '') IS NOT NULL
    OR NULLIF(BTRIM(p.avatar_url), '') IS NOT NULL
  );
