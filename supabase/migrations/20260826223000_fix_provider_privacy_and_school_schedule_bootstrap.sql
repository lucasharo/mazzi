-- MAZZI — audit remediation: provider privacy, driving-school CNPJ integrity,
-- and one-time default schedule bootstrap for new driving schools.
-- DEV/forward-only migration.

-- 1) Public provider discovery must go through the dedicated public RPCs.
-- Direct anon SELECT on the base table exposes private columns such as
-- document_number and exact coordinates.
REVOKE SELECT ON TABLE public.providers FROM PUBLIC, anon;
DROP POLICY IF EXISTS anon_public_active_providers ON public.providers;

-- 2) Reconcile the known DEV/demo driving-school fixtures that predate the
-- authoritative CNPJ validator. These values are synthetic DEV identifiers
-- with valid CNPJ check digits and remain unique.
UPDATE public.providers
SET document_number = CASE document_number
  WHEN '55000000000001' THEN '55999999000116'
  WHEN '55000000000002' THEN '55999999000205'
  WHEN '55000000000003' THEN '55999999000388'
  WHEN '55000000000004' THEN '55999999000469'
  WHEN '55000000000005' THEN '55999999000540'
  WHEN '55000000000006' THEN '55999999000620'
  WHEN '55000000000007' THEN '55999999000701'
  WHEN '55000000000008' THEN '55999999000892'
  WHEN '55000000000009' THEN '55999999000973'
  WHEN '55000000000010' THEN '55999999001007'
  ELSE document_number
END,
updated_at = now()
WHERE type = 'DRIVING_SCHOOL'::public.provider_type
  AND document_number IN (
    '55000000000001','55000000000002','55000000000003','55000000000004','55000000000005',
    '55000000000006','55000000000007','55000000000008','55000000000009','55000000000010'
  );

ALTER TABLE public.providers
  DROP CONSTRAINT IF EXISTS providers_driving_school_cnpj_valid_ck;

ALTER TABLE public.providers
  ADD CONSTRAINT providers_driving_school_cnpj_valid_ck
  CHECK (
    type <> 'DRIVING_SCHOOL'::public.provider_type
    OR (
      document_number IS NOT NULL
      AND document_number ~ '^[0-9]{14}$'
      AND public.validate_cnpj(document_number)
    )
  ) NOT VALID;

ALTER TABLE public.providers
  VALIDATE CONSTRAINT providers_driving_school_cnpj_valid_ck;

-- 3) Do not backfill schedules for schools that already existed before this
-- feature. Mark them as bootstrap-processed without creating availability.
INSERT INTO public.provider_schedule_bootstrap(provider_id)
SELECT p.id
FROM public.providers p
WHERE p.type = 'DRIVING_SCHOOL'::public.provider_type
ON CONFLICT (provider_id) DO NOTHING;

-- New driving schools should receive the same initial Mon-Fri 08:00-18:00
-- availability once a real schedulable resource (active school instructor +
-- school vehicle) is first represented by an offering. The marker makes this
-- one-shot: user edits/deletes are never recreated automatically.
CREATE OR REPLACE FUNCTION public.bootstrap_driving_school_default_availability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_provider_type public.provider_type;
BEGIN
  SELECT p.type INTO v_provider_type
  FROM public.providers p
  WHERE p.id = NEW.provider_id;

  IF NOT FOUND OR v_provider_type <> 'DRIVING_SCHOOL'::public.provider_type THEN
    RETURN NEW;
  END IF;

  IF NEW.instructor_id IS NULL OR NEW.vehicle_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Serialize concurrent first-offering creation for the same school.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('driving-school-schedule-bootstrap:' || NEW.provider_id::text, 0)
  );

  IF EXISTS (
    SELECT 1
    FROM public.provider_schedule_bootstrap b
    WHERE b.provider_id = NEW.provider_id
  ) THEN
    RETURN NEW;
  END IF;

  -- Only a real school resource can trigger the default.
  IF NOT EXISTS (
    SELECT 1
    FROM public.vehicles v
    WHERE v.id = NEW.vehicle_id
      AND v.provider_id = NEW.provider_id
      AND v.deleted_at IS NULL
  ) OR NOT EXISTS (
    SELECT 1
    FROM public.driving_school_staff dss
    WHERE dss.school_id = NEW.provider_id
      AND dss.user_id = NEW.instructor_id
      AND dss.role = 'INSTRUCTOR'::public.user_role
      AND dss.membership_status = 'ACTIVE'::public.school_membership_status
      AND dss.is_active IS TRUE
  ) THEN
    RETURN NEW;
  END IF;

  -- Respect any availability the school configured before its first offering.
  IF EXISTS (
    SELECT 1
    FROM public.availabilities a
    WHERE a.provider_id = NEW.provider_id
  ) THEN
    INSERT INTO public.provider_schedule_bootstrap(provider_id)
    VALUES (NEW.provider_id)
    ON CONFLICT (provider_id) DO NOTHING;
    RETURN NEW;
  END IF;

  INSERT INTO public.availabilities (
    provider_id,
    instructor_id,
    vehicle_id,
    day_of_week,
    start_time,
    end_time,
    timezone,
    is_active
  )
  SELECT
    NEW.provider_id,
    NEW.instructor_id,
    NEW.vehicle_id,
    weekday,
    TIME '08:00',
    TIME '18:00',
    'America/Sao_Paulo',
    TRUE
  FROM generate_series(1, 5) AS weekday;

  INSERT INTO public.provider_schedule_bootstrap(provider_id)
  VALUES (NEW.provider_id)
  ON CONFLICT (provider_id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_driving_school_default_availability()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS bootstrap_driving_school_default_availability_on_offering
ON public.service_offerings;

CREATE TRIGGER bootstrap_driving_school_default_availability_on_offering
AFTER INSERT ON public.service_offerings
FOR EACH ROW
EXECUTE FUNCTION public.bootstrap_driving_school_default_availability();
