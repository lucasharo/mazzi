-- R10B: rebuild the two enums with the canonical status labels.
-- Dependencies are dropped and recreated explicitly; no cascading drop is used.
BEGIN;

DROP FUNCTION public.get_public_vehicle_catalog();
DROP FUNCTION public.review_compliance_document(uuid, public.compliance_status, text);
DROP FUNCTION public.review_vehicle(uuid, public.vehicle_status, text);
DROP POLICY IF EXISTS "Providers can insert own compliance documents" ON public.compliance_documents;
DROP VIEW public.public_service_offerings;
DROP VIEW public.public_vehicles;

ALTER TABLE public.compliance_documents ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.vehicles ALTER COLUMN status DROP DEFAULT;

CREATE TYPE public.compliance_status_r10b AS ENUM (
  'PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'IN_REVIEW'
);
CREATE TYPE public.vehicle_status_r10b AS ENUM (
  'DRAFT', 'PENDING', 'IN_REVIEW', 'ACTIVE', 'INACTIVE', 'EXPIRED', 'BLOCKED'
);

ALTER TABLE public.compliance_documents
  ALTER COLUMN status TYPE public.compliance_status_r10b
  USING status::text::public.compliance_status_r10b;
ALTER TABLE public.vehicles
  ALTER COLUMN status TYPE public.vehicle_status_r10b
  USING status::text::public.vehicle_status_r10b;

DROP TYPE public.compliance_status;
DROP TYPE public.vehicle_status;

ALTER TYPE public.compliance_status_r10b RENAME TO compliance_status;
ALTER TYPE public.vehicle_status_r10b RENAME TO vehicle_status;

CREATE VIEW public.public_vehicles AS
  SELECT id, provider_id, brand, model, year, vehicle_type, category, transmission,
    color, photos, (((((brand::text || ' '::text) || model::text) || ' ('::text)
      || year) || ')'::text) AS display_title
  FROM public.vehicles v
  WHERE status='ACTIVE'::public.vehicle_status AND deleted_at IS NULL;
GRANT SELECT ON public.public_vehicles TO anon, authenticated;

CREATE VIEW public.public_service_offerings AS
  SELECT so.id, so.provider_id, so.vehicle_id, so.category, so.duration_minutes,
    so.price_in_cents, so.status, pv.brand AS vehicle_brand, pv.model AS vehicle_model,
    pv.year AS vehicle_year, pv.transmission AS vehicle_transmission,
    pv.photos AS vehicle_photos
  FROM public.service_offerings so
  JOIN public.public_vehicles pv ON pv.id=so.vehicle_id
  JOIN public.providers p ON p.id=so.provider_id
  WHERE so.status::text='ACTIVE' AND p.status='ACTIVE'::public.provider_status;
GRANT SELECT ON public.public_service_offerings TO anon, authenticated;

ALTER TABLE public.compliance_documents
  ALTER COLUMN status SET DEFAULT 'PENDING'::public.compliance_status;
ALTER TABLE public.vehicles
  ALTER COLUMN status SET DEFAULT 'PENDING'::public.vehicle_status;

CREATE POLICY "Providers can insert own compliance documents"
  ON public.compliance_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_current_user_active()
    AND (public.is_provider_owner(provider_id) OR user_id = auth.uid())
    AND (
      status IN ('PENDING'::public.compliance_status, 'IN_REVIEW'::public.compliance_status)
      OR (
        document_type = 'MAZZI_TERMS_ACCEPTANCE'::public.compliance_doc_type
        AND status = 'APPROVED'::public.compliance_status
        AND storage_path::text LIKE 'acceptance://mazzi-ethics/%'
      )
    )
  );

CREATE OR REPLACE FUNCTION public.get_public_vehicle_catalog()
RETURNS TABLE(id uuid, provider_id uuid, brand varchar, model varchar, year integer,
  license_plate varchar, license_plate_masked varchar, category public.vehicle_category,
  vehicle_type public.vehicle_type, transmission public.vehicle_transmission,
  status public.vehicle_status, color varchar, photos text[], created_at timestamptz,
  updated_at timestamptz, deleted_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT v.id,v.provider_id,v.brand,v.model,v.year,
    CASE WHEN public.is_platform_admin() OR public.is_school_admin(v.provider_id)
      OR EXISTS (SELECT 1 FROM public.providers p WHERE p.id=v.provider_id AND p.user_id=auth.uid())
      THEN v.license_plate ELSE coalesce(v.license_plate_masked,'***-****') END,
    coalesce(v.license_plate_masked,'***-****'),v.category,v.vehicle_type,v.transmission,
    v.status,v.color,v.photos,v.created_at,v.updated_at,v.deleted_at
  FROM public.vehicles v
  WHERE (v.status='ACTIVE'::public.vehicle_status AND v.deleted_at IS NULL)
    OR public.is_platform_admin() OR public.is_school_admin(v.provider_id)
    OR EXISTS (SELECT 1 FROM public.providers p WHERE p.id=v.provider_id AND p.user_id=auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.review_compliance_document(
  p_document_id uuid, p_status public.compliance_status, p_rejection_reason text DEFAULT NULL)
RETURNS public.compliance_documents
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_doc public.compliance_documents;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT public.is_compliance_reviewer() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_status NOT IN ('APPROVED', 'REJECTED') THEN RAISE EXCEPTION 'INVALID_REVIEW_STATUS'; END IF;
  UPDATE public.compliance_documents
  SET status=p_status,
      rejection_reason=CASE WHEN p_status='REJECTED' THEN p_rejection_reason ELSE NULL END,
      reviewed_by=auth.uid(), reviewed_at=NOW(), updated_at=NOW()
  WHERE id=p_document_id RETURNING * INTO v_doc;
  IF NOT FOUND THEN RAISE EXCEPTION 'DOCUMENT_NOT_FOUND'; END IF;
  RETURN v_doc;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_vehicle(
  p_vehicle_id uuid, p_status public.vehicle_status, p_reason text DEFAULT NULL)
RETURNS public.vehicles
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_uid uuid := auth.uid(); v_previous public.vehicles; v_updated public.vehicles;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='28000'; END IF;
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF p_status NOT IN ('ACTIVE','INACTIVE','BLOCKED') THEN RAISE EXCEPTION 'INVALID_VEHICLE_REVIEW_STATUS' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_previous FROM public.vehicles WHERE id=p_vehicle_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'VEHICLE_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  UPDATE public.vehicles SET status=p_status,updated_at=now() WHERE id=p_vehicle_id RETURNING * INTO v_updated;
  INSERT INTO public.audit_logs(id,actor_id,action,entity_type,entity_id,previous_value,new_value,created_at)
  VALUES(gen_random_uuid(),v_uid,'REVIEW_VEHICLE','Vehicle',p_vehicle_id::text,
    jsonb_build_object('status',v_previous.status,'reason',NULL),
    jsonb_build_object('status',p_status,'reason',NULLIF(btrim(p_reason),'')),now());
  RETURN v_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_vehicle_catalog() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_compliance_document(uuid,public.compliance_status,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_vehicle(uuid,public.vehicle_status,text) TO authenticated;
COMMIT;
