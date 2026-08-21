-- MAZZI — Global instructor compliance and contextual document scope
-- Forward-only extension. Existing provider-centric RLS remains unchanged.

CREATE TYPE public.compliance_document_scope AS ENUM (
  'USER_GLOBAL',
  'PROVIDER',
  'MEMBERSHIP',
  'VEHICLE'
);

ALTER TABLE public.compliance_documents
  ALTER COLUMN provider_id DROP NOT NULL,
  ADD COLUMN scope public.compliance_document_scope,
  ADD COLUMN membership_id UUID NULL
    REFERENCES public.driving_school_staff(id),
  ADD CONSTRAINT compliance_documents_membership_user_fk_check
    CHECK (membership_id IS NULL OR user_id IS NOT NULL);

-- Preserve historical meaning: vehicle documents remain vehicle-scoped;
-- all other existing documents remain provider-scoped.
UPDATE public.compliance_documents
SET scope = CASE
  WHEN vehicle_id IS NOT NULL THEN 'VEHICLE'::public.compliance_document_scope
  ELSE 'PROVIDER'::public.compliance_document_scope
END
WHERE scope IS NULL;

ALTER TABLE public.compliance_documents
  ALTER COLUMN scope SET NOT NULL;

ALTER TABLE public.compliance_documents
  ADD CONSTRAINT compliance_documents_scope_shape_check
  CHECK (
    (scope = 'USER_GLOBAL'::public.compliance_document_scope
      AND user_id IS NOT NULL
      AND provider_id IS NULL
      AND membership_id IS NULL
      AND vehicle_id IS NULL)
    OR
    (scope = 'PROVIDER'::public.compliance_document_scope
      AND provider_id IS NOT NULL
      AND membership_id IS NULL
      AND vehicle_id IS NULL)
    OR
    (scope = 'MEMBERSHIP'::public.compliance_document_scope
      AND membership_id IS NOT NULL
      AND user_id IS NOT NULL
      AND provider_id IS NULL
      AND vehicle_id IS NULL)
    OR
    (scope = 'VEHICLE'::public.compliance_document_scope
      AND provider_id IS NOT NULL
      AND vehicle_id IS NOT NULL
      AND membership_id IS NULL)
  );

CREATE OR REPLACE FUNCTION public.validate_compliance_document_membership_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_membership_user_id UUID;
BEGIN
  IF NEW.scope = 'MEMBERSHIP'::public.compliance_document_scope THEN
    SELECT dss.user_id
      INTO v_membership_user_id
      FROM public.driving_school_staff AS dss
     WHERE dss.id = NEW.membership_id;

    IF NOT FOUND OR v_membership_user_id IS DISTINCT FROM NEW.user_id THEN
      RAISE EXCEPTION 'MEMBERSHIP_DOCUMENT_USER_MISMATCH';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_compliance_document_membership_user
  ON public.compliance_documents;
CREATE CONSTRAINT TRIGGER validate_compliance_document_membership_user
AFTER INSERT OR UPDATE OF scope, membership_id, user_id
ON public.compliance_documents
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW
EXECUTE FUNCTION public.validate_compliance_document_membership_user();

REVOKE ALL ON FUNCTION public.validate_compliance_document_membership_user() FROM PUBLIC;

CREATE INDEX IF NOT EXISTS idx_compliance_documents_scope_user_type
  ON public.compliance_documents (scope, user_id, document_type);
CREATE INDEX IF NOT EXISTS idx_compliance_documents_membership_id
  ON public.compliance_documents (membership_id);

ALTER TABLE public.compliance_requirements
  ADD COLUMN scope public.compliance_document_scope NULL;

-- Only unambiguous catalog entries are classified. Historical and internal
-- terms remain NULL until a future product/regulatory decision defines scope.
UPDATE public.compliance_requirements
SET scope = 'USER_GLOBAL'::public.compliance_document_scope
WHERE provider_type = 'INSTRUCTOR'
  AND document_type IN (
    'CNH_EAR',
    'CREDENTIAL_DETRAN',
    'CRIMINAL_BACKGROUND',
    'CREDENTIAL_DETRAN_SP'
  );

UPDATE public.compliance_requirements
SET scope = 'PROVIDER'::public.compliance_document_scope
WHERE provider_type = 'DRIVING_SCHOOL'
  AND document_type IN (
    'COMPANY_REGISTRATION',
    'CFC_AUTHORIZATION',
    'CFC_AUTHORIZATION_STATE',
    'CFC_ALVARA'
  );

-- No RLS or grants are changed here. Existing provider-centric policies remain
-- the only Data API access path until scoped RPCs are introduced separately.
