-- Keep Aula Agora availability independent per vehicle.
-- Disabling one vehicle must not disable another vehicle from the same
-- instructor, but pending offers for the disabled vehicle must stop being
-- actionable immediately.

BEGIN;

CREATE OR REPLACE FUNCTION public.expire_instant_offers_when_disabled()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.instant_enabled IS DISTINCT FROM TRUE THEN
    NEW.instant_online := FALSE;

    UPDATE public.instant_lesson_offers
    SET status = 'EXPIRED', updated_at = NOW()
    WHERE offering_id = NEW.offering_id
      AND status = 'PENDING'
      AND expires_at > NOW();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS provider_instant_setting_visibility_trigger
  ON public.provider_instant_settings;

CREATE TRIGGER provider_instant_setting_visibility_trigger
BEFORE INSERT OR UPDATE OF instant_enabled, instant_online
ON public.provider_instant_settings
FOR EACH ROW
EXECUTE FUNCTION public.expire_instant_offers_when_disabled();

-- Clean up offers created before this guard existed. The setting remains
-- independent for every instructor/vehicle pair.
UPDATE public.instant_lesson_offers io
SET status = 'EXPIRED', updated_at = NOW()
FROM public.provider_instant_settings s
WHERE s.offering_id = io.offering_id
  AND s.instant_enabled IS DISTINCT FROM TRUE
  AND io.status = 'PENDING'
  AND io.expires_at > NOW();

COMMIT;
