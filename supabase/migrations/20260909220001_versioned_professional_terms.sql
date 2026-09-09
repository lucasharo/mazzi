-- TASK-093: immutable, versioned professional terms acceptance.
-- DEV only rollout: preserve v1 rows and do not downgrade active providers.
BEGIN;

ALTER TABLE public.compliance_documents
  ADD COLUMN IF NOT EXISTS terms_version TEXT,
  ADD COLUMN IF NOT EXISTS document_hash TEXT,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

UPDATE public.compliance_documents
SET terms_version = regexp_replace(storage_path, '^acceptance://mazzi-ethics/', '')
WHERE document_type = 'MAZZI_TERMS_ACCEPTANCE'::public.compliance_doc_type
  AND terms_version IS NULL
  AND storage_path LIKE 'acceptance://mazzi-ethics/%';

UPDATE public.compliance_documents
SET accepted_at = created_at
WHERE accepted_at IS NULL;

ALTER TABLE public.compliance_documents
  ALTER COLUMN accepted_at SET DEFAULT NOW(),
  ALTER COLUMN accepted_at SET NOT NULL;

ALTER TABLE public.compliance_documents
  DROP CONSTRAINT IF EXISTS compliance_documents_terms_metadata_check;

ALTER TABLE public.compliance_documents
  ADD CONSTRAINT compliance_documents_terms_metadata_check CHECK (
    document_type <> 'MAZZI_TERMS_ACCEPTANCE'::public.compliance_doc_type
    OR (
      terms_version IS NOT NULL
      AND btrim(terms_version) <> ''
      AND terms_version ~ '^[A-Za-z0-9._-]+$'
      AND (document_hash IS NULL OR document_hash ~ '^sha256:[0-9a-f]{64}$')
    )
  );

CREATE INDEX IF NOT EXISTS compliance_documents_terms_history_idx
  ON public.compliance_documents (provider_id, user_id, document_type, terms_version, accepted_at DESC)
  WHERE document_type = 'MAZZI_TERMS_ACCEPTANCE'::public.compliance_doc_type;

CREATE OR REPLACE FUNCTION public.current_mazzi_terms_version()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT 'v2'::text;
$$;

REVOKE ALL ON FUNCTION public.current_mazzi_terms_version() FROM PUBLIC, anon, authenticated;

DROP FUNCTION public.provider_accept_mazzi_terms(uuid, text);

CREATE FUNCTION public.provider_accept_mazzi_terms(
  p_provider_id uuid,
  p_terms_version text
)
RETURNS public.compliance_documents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_doc public.compliance_documents;
  v_current_version text := public.current_mazzi_terms_version();
  v_path text;
  v_hash text := 'sha256:c256a7d94920ada35d9a7ad6528cb38a1bf7cdd23e0e336d6b4c48eba2c8b69f';
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'USER_NOT_ACTIVE' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_provider_owner(p_provider_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF p_terms_version IS DISTINCT FROM v_current_version THEN
    RAISE EXCEPTION 'TERMS_VERSION_NOT_CURRENT' USING ERRCODE = '22023';
  END IF;

  v_path := 'acceptance://mazzi-ethics/' || v_current_version;

  SELECT * INTO v_doc
  FROM public.compliance_documents
  WHERE provider_id = p_provider_id
    AND user_id = auth.uid()
    AND scope = 'PROVIDER'::public.compliance_document_scope
    AND document_type = 'MAZZI_TERMS_ACCEPTANCE'::public.compliance_doc_type
    AND status = 'APPROVED'::public.compliance_status
    AND terms_version = v_current_version
    AND storage_path = v_path
  ORDER BY accepted_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN v_doc;
  END IF;

  INSERT INTO public.compliance_documents (
    provider_id, user_id, vehicle_id, membership_id, scope,
    document_type, storage_path, status, terms_version, document_hash, accepted_at
  ) VALUES (
    p_provider_id, auth.uid(), NULL, NULL,
    'PROVIDER'::public.compliance_document_scope,
    'MAZZI_TERMS_ACCEPTANCE'::public.compliance_doc_type,
    v_path,
    'APPROVED'::public.compliance_status,
    v_current_version,
    v_hash,
    NOW()
  )
  RETURNING * INTO v_doc;

  INSERT INTO public.audit_logs (
    actor_id, action, entity_type, entity_id, new_value, severity, created_at
  ) VALUES (
    auth.uid(), 'MAZZI_TERMS_ACCEPTED', 'COMPLIANCE_DOCUMENTS', v_doc.id,
    jsonb_build_object(
      'provider_id', p_provider_id,
      'document_type', 'MAZZI_TERMS_ACCEPTANCE',
      'terms_version', v_current_version,
      'document_hash', v_hash,
      'accepted_at', v_doc.accepted_at,
      'scope', 'PROVIDER'
    ),
    'INFO', NOW()
  );

  RETURN v_doc;
END;
$$;

REVOKE ALL ON FUNCTION public.provider_accept_mazzi_terms(uuid, text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.provider_accept_mazzi_terms(uuid, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.is_provider_activation_eligible(p_provider_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.providers p
    JOIN public.users u ON u.id = p.user_id
    WHERE p.id = p_provider_id
      AND p.type = 'INSTRUCTOR'::public.provider_type
      AND p.status IN ('DRAFT'::public.provider_status, 'PENDING_REVIEW'::public.provider_status)
      AND u.status = 'ACTIVE'
      AND (u.role = 'INSTRUCTOR'::public.user_role OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = u.id AND ur.role = 'INSTRUCTOR'::public.user_role
      ))
      AND NOT EXISTS (
        SELECT 1
        FROM public.compliance_requirements r
        WHERE r.scope = 'USER_GLOBAL'::public.compliance_document_scope
          AND r.provider_type = 'INSTRUCTOR'::public.provider_type
          AND r.is_mandatory IS TRUE
          AND (r.effective_from IS NULL OR r.effective_from <= NOW())
          AND (r.effective_to IS NULL OR r.effective_to >= NOW())
          AND r.regulatory_status NOT IN ('SUPERSEDED', 'INACTIVE')
          AND NOT EXISTS (
            SELECT 1
            FROM public.compliance_documents d
            WHERE d.status = 'APPROVED'::public.compliance_status
              AND (d.expires_at IS NULL OR d.expires_at > NOW())
              AND (
                (d.scope = 'USER_GLOBAL'::public.compliance_document_scope
                 AND d.user_id = p.user_id AND d.provider_id IS NULL)
                OR
                (d.scope = 'PROVIDER'::public.compliance_document_scope
                 AND d.provider_id = p.id)
              )
              AND (
                d.document_type::text = r.document_type::text
                OR (r.document_type::text = 'CNH_EAR' AND d.document_type::text = 'CNH')
                OR (r.document_type::text = 'CREDENTIAL_DETRAN_SP' AND d.document_type::text = 'CREDENTIAL_DETRAN')
              )
          )
      )
      AND EXISTS (
        SELECT 1
        FROM public.compliance_documents terms
        WHERE terms.provider_id = p.id
          AND terms.user_id = p.user_id
          AND terms.scope = 'PROVIDER'::public.compliance_document_scope
          AND terms.document_type = 'MAZZI_TERMS_ACCEPTANCE'::public.compliance_doc_type
          AND terms.status = 'APPROVED'::public.compliance_status
          AND terms.terms_version = public.current_mazzi_terms_version()
          AND terms.document_hash = 'sha256:c256a7d94920ada35d9a7ad6528cb38a1bf7cdd23e0e336d6b4c48eba2c8b69f'
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_provider_activation_eligible(uuid)
  FROM PUBLIC, anon, authenticated;

-- Do not mass-downgrade active providers during the version rollout. New
-- activation/eligibility checks require v2; existing v1 rows remain intact and
-- each provider can explicitly accept v2 through the normal flow.

COMMIT;

