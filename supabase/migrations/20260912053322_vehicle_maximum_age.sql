BEGIN;

CREATE OR REPLACE FUNCTION public.validate_vehicle_maximum_age()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.year < EXTRACT(YEAR FROM CURRENT_DATE)::integer - 12 THEN
    RAISE EXCEPTION 'VEHICLE_TOO_OLD' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vehicles_maximum_age_check ON public.vehicles;
CREATE TRIGGER vehicles_maximum_age_check
  BEFORE INSERT OR UPDATE OF year ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.validate_vehicle_maximum_age();

COMMIT;
