-- Pin the trigger function lookup path after enabling the historical vehicle
-- age rule in DEV.

ALTER FUNCTION public.validate_vehicle_maximum_age()
  SET search_path = public, pg_temp;
