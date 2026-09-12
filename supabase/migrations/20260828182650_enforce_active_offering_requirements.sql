-- Mantém ofertas ativas coerentes com todos os requisitos operacionais.

CREATE OR REPLACE FUNCTION public.deactivate_invalid_service_offerings_now()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  UPDATE public.service_offerings o
  SET status = 'INACTIVE',
      is_active = FALSE,
      updated_at = NOW()
  WHERE o.status = 'ACTIVE'
    AND (
      NOT EXISTS (
        SELECT 1
        FROM public.providers p
        WHERE p.id = o.provider_id
          AND p.status = 'ACTIVE'
      )
      OR NOT EXISTS (
        SELECT 1
        FROM public.vehicles v
        WHERE v.id = o.vehicle_id
          AND v.provider_id = o.provider_id
          AND v.status = 'ACTIVE'
          AND v.deleted_at IS NULL
          AND v.category = o.category
          AND v.transmission = o.transmission
      )
      OR o.instructor_id IS NULL
      OR o.duration_minutes <> 50
      OR o.price_in_cents IS NULL
      OR o.price_in_cents <= 0
      OR NOT public.is_provider_instructor_eligible(o.provider_id, o.instructor_id, o.category)
    );

END;
$$;

CREATE OR REPLACE FUNCTION public.deactivate_invalid_service_offerings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  PERFORM public.deactivate_invalid_service_offerings_now();
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_active_service_offering()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.status = 'ACTIVE' OR NEW.is_active IS TRUE THEN
    IF NEW.status <> 'ACTIVE' OR NEW.is_active IS NOT TRUE THEN
      RAISE EXCEPTION 'OFFERING_LIFECYCLE_INCONSISTENT: Oferta ativa precisa estar com status ACTIVE e is_active=true.' USING ERRCODE = '23514';
    END IF;
    IF NEW.duration_minutes <> 50 THEN
      RAISE EXCEPTION 'OFFERING_DURATION_MUST_BE_50: A oferta precisa ter duração de 50 minutos.' USING ERRCODE = '22023';
    END IF;
    IF NEW.price_in_cents IS NULL OR NEW.price_in_cents <= 0 OR NEW.price_in_cents <> trunc(NEW.price_in_cents) THEN
      RAISE EXCEPTION 'OFFERING_PRICE_INVALID: O preço da oferta precisa ser maior que zero.' USING ERRCODE = '22023';
    END IF;
    IF NEW.instructor_id IS NULL THEN
      RAISE EXCEPTION 'OFFERING_INSTRUCTOR_REQUIRED: A oferta precisa ter um instrutor vinculado.' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.providers p WHERE p.id = NEW.provider_id AND p.status = 'ACTIVE') THEN
      RAISE EXCEPTION 'OFFERING_PROVIDER_NOT_ACTIVE: O prestador precisa estar ativo para ativar a oferta.' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.vehicles v
      WHERE v.id = NEW.vehicle_id
        AND v.provider_id = NEW.provider_id
        AND v.status = 'ACTIVE'
        AND v.deleted_at IS NULL
        AND v.category = NEW.category
        AND v.transmission = NEW.transmission
    ) THEN
      RAISE EXCEPTION 'OFFERING_VEHICLE_NOT_ACTIVE: O veículo precisa estar ativo e compatível com a oferta.' USING ERRCODE = '22023';
    END IF;
    IF NOT public.is_provider_instructor_eligible(NEW.provider_id, NEW.instructor_id, NEW.category) THEN
      RAISE EXCEPTION 'OFFERING_INSTRUCTOR_NOT_ELIGIBLE: O instrutor não está elegível para esta oferta.' USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.deactivate_invalid_service_offerings_now() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.deactivate_invalid_service_offerings() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_active_service_offering() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.deactivate_invalid_service_offerings_now() TO service_role;
GRANT EXECUTE ON FUNCTION public.deactivate_invalid_service_offerings() TO service_role;
GRANT EXECUTE ON FUNCTION public.validate_active_service_offering() TO service_role;

DROP TRIGGER IF EXISTS validate_active_service_offering ON public.service_offerings;
CREATE TRIGGER validate_active_service_offering
BEFORE INSERT OR UPDATE ON public.service_offerings
FOR EACH ROW
EXECUTE FUNCTION public.validate_active_service_offering();

DROP TRIGGER IF EXISTS deactivate_offerings_on_vehicle_change ON public.vehicles;
CREATE TRIGGER deactivate_offerings_on_vehicle_change
AFTER UPDATE OF provider_id, category, transmission, status, deleted_at ON public.vehicles
FOR EACH ROW
EXECUTE FUNCTION public.deactivate_invalid_service_offerings();

DROP TRIGGER IF EXISTS deactivate_offerings_on_provider_change ON public.providers;
CREATE TRIGGER deactivate_offerings_on_provider_change
AFTER UPDATE OF status ON public.providers
FOR EACH ROW
EXECUTE FUNCTION public.deactivate_invalid_service_offerings();

DROP TRIGGER IF EXISTS deactivate_offerings_on_compliance_change ON public.compliance_documents;
CREATE TRIGGER deactivate_offerings_on_compliance_change
AFTER INSERT OR UPDATE OR DELETE ON public.compliance_documents
FOR EACH ROW
EXECUTE FUNCTION public.deactivate_invalid_service_offerings();

DROP TRIGGER IF EXISTS deactivate_offerings_on_membership_change ON public.driving_school_staff;
CREATE TRIGGER deactivate_offerings_on_membership_change
AFTER INSERT OR UPDATE OR DELETE ON public.driving_school_staff
FOR EACH ROW
EXECUTE FUNCTION public.deactivate_invalid_service_offerings();

DROP TRIGGER IF EXISTS deactivate_offerings_on_instructor_change ON public.users;
CREATE TRIGGER deactivate_offerings_on_instructor_change
AFTER UPDATE OF status, role ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.deactivate_invalid_service_offerings();

-- Corrige dados antigos que já não atendem aos requisitos atuais.
SELECT public.deactivate_invalid_service_offerings_now();
