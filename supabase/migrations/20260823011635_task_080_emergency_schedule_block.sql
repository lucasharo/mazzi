-- TASK-080: atomic emergency blocks for autonomous instructors.
-- The same transaction advisory lock serializes emergency blocks and new bookings.

CREATE OR REPLACE FUNCTION public.create_instructor_emergency_block_if_free(
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
  v_block_id uuid;
  v_reason text := COALESCE(NULLIF(trim(p_reason), ''), 'Bloqueio rápido de emergência');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = v_uid AND u.status = 'ACTIVE'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid AND ur.role = 'INSTRUCTOR'
  ) THEN
    RAISE EXCEPTION 'EMERGENCY_BLOCK_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  IF p_start_at IS NULL OR p_end_at IS NULL OR p_end_at <= p_start_at THEN
    RAISE EXCEPTION 'EMERGENCY_BLOCK_INVALID_RANGE' USING ERRCODE = '22023';
  END IF;
  IF p_end_at <= v_now THEN
    RAISE EXCEPTION 'EMERGENCY_BLOCK_IN_PAST' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('instructor-schedule:' || v_uid::text, 0)
  );

  IF EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.instructor_id = v_uid
      AND b.scheduled_start_at < p_end_at
      AND p_start_at < b.scheduled_end_at
      AND (
        b.status IN ('CONFIRMED', 'IN_PROGRESS')
        OR (b.status = 'PENDING_PAYMENT' AND (b.hold_expires_at IS NULL OR b.hold_expires_at > v_now))
      )
  ) THEN
    RAISE EXCEPTION 'EMERGENCY_BLOCK_BOOKING_CONFLICT' USING ERRCODE = '23P01';
  END IF;

  SELECT b.id INTO v_block_id
  FROM public.instructor_global_blocks b
  WHERE b.instructor_id = v_uid
    AND b.start_at <= p_start_at
    AND b.end_at >= p_end_at
  ORDER BY b.created_at
  LIMIT 1;

  IF v_block_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true, 'already_blocked', true, 'id', v_block_id,
      'instructor_id', v_uid, 'start_at', p_start_at, 'end_at', p_end_at,
      'reason', v_reason
    );
  END IF;

  v_block_id := gen_random_uuid();
  INSERT INTO public.instructor_global_blocks
    (id, instructor_id, start_at, end_at, reason, created_at, updated_at)
  VALUES
    (v_block_id, v_uid, p_start_at, p_end_at, v_reason, v_now, v_now);

  RETURN jsonb_build_object(
    'success', true, 'already_blocked', false, 'id', v_block_id,
    'instructor_id', v_uid, 'start_at', p_start_at, 'end_at', p_end_at,
    'reason', v_reason
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_booking_during_instructor_global_block()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF NEW.status IN ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS') THEN
    PERFORM pg_advisory_xact_lock(
      hashtextextended('instructor-schedule:' || NEW.instructor_id::text, 0)
    );

    IF EXISTS (
      SELECT 1
      FROM public.instructor_global_blocks b
      WHERE b.instructor_id = NEW.instructor_id
        AND b.start_at < NEW.scheduled_end_at
        AND NEW.scheduled_start_at < b.end_at
    ) THEN
      RAISE EXCEPTION 'SLOT_NO_LONGER_AVAILABLE' USING ERRCODE = '23P01';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_booking_during_instructor_global_block_trigger
  ON public.bookings;
CREATE TRIGGER prevent_booking_during_instructor_global_block_trigger
  BEFORE INSERT OR UPDATE OF instructor_id, scheduled_start_at, scheduled_end_at, status
  ON public.bookings
  FOR EACH ROW
  WHEN (NEW.status IN ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS'))
  EXECUTE FUNCTION public.prevent_booking_during_instructor_global_block();

REVOKE ALL ON FUNCTION public.create_instructor_emergency_block_if_free(timestamptz, timestamptz, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_instructor_emergency_block_if_free(timestamptz, timestamptz, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_instructor_emergency_block_if_free(timestamptz, timestamptz, text) TO authenticated;

REVOKE ALL ON FUNCTION public.prevent_booking_during_instructor_global_block() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_booking_during_instructor_global_block() FROM anon;
REVOKE ALL ON FUNCTION public.prevent_booking_during_instructor_global_block() FROM authenticated;
