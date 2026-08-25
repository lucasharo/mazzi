-- R11: keep ACTIVE service offerings consistent with provider lifecycle.
BEGIN;

CREATE OR REPLACE FUNCTION public.deactivate_provider_offerings_on_lifecycle_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF OLD.status = 'ACTIVE' AND NEW.status <> 'ACTIVE' THEN
    UPDATE public.service_offerings
    SET status = 'INACTIVE',
        is_active = FALSE,
        updated_at = NOW()
    WHERE provider_id = NEW.id
      AND (status = 'ACTIVE' OR is_active IS TRUE);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.deactivate_provider_offerings_on_lifecycle_change()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS deactivate_provider_offerings_on_provider_lifecycle
  ON public.providers;

CREATE TRIGGER deactivate_provider_offerings_on_provider_lifecycle
AFTER UPDATE OF status ON public.providers
FOR EACH ROW
EXECUTE FUNCTION public.deactivate_provider_offerings_on_lifecycle_change();

UPDATE public.service_offerings o
SET status = 'INACTIVE',
    is_active = FALSE,
    updated_at = NOW()
FROM public.providers p
WHERE p.id = o.provider_id
  AND p.status <> 'ACTIVE'
  AND (o.status = 'ACTIVE' OR o.is_active IS TRUE);

COMMIT;
