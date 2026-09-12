-- Public search must never expose an instructor who is not fully eligible.
-- Remove the legacy no-documents bypass from the authoritative eligibility RPC.

CREATE OR REPLACE FUNCTION public.is_instructor_global_compliance_valid(
  p_user_id UUID,
  p_category public.vehicle_category DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = p_user_id
      AND u.status = 'ACTIVE'::public.user_status
      AND (
        u.role = 'INSTRUCTOR'::public.user_role
        OR EXISTS (
          SELECT 1
          FROM public.user_roles ur
          WHERE ur.user_id = u.id
            AND ur.role = 'INSTRUCTOR'::public.user_role
        )
      )
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.compliance_requirements r
    WHERE r.scope = 'USER_GLOBAL'::public.compliance_document_scope
      AND r.is_mandatory IS TRUE
      AND (p_category IS NULL OR r.category IS NULL OR r.category = p_category)
      AND (r.effective_from IS NULL OR r.effective_from <= NOW())
      AND (r.effective_to IS NULL OR r.effective_to >= NOW())
      AND r.regulatory_status NOT IN ('SUPERSEDED', 'INACTIVE')
      AND NOT EXISTS (
        SELECT 1
        FROM public.compliance_documents d
        WHERE d.status = 'APPROVED'::public.compliance_status
          AND (d.expires_at IS NULL OR d.expires_at > NOW())
          AND (
            (
              d.scope = 'USER_GLOBAL'::public.compliance_document_scope
              AND d.user_id = p_user_id
              AND d.provider_id IS NULL
            )
            OR (
              d.scope = 'PROVIDER'::public.compliance_document_scope
              AND d.provider_id IN (
                SELECT p.id
                FROM public.providers p
                WHERE p.type = 'INSTRUCTOR'::public.provider_type
                  AND p.user_id = p_user_id
              )
            )
          )
          AND (
            d.document_type::TEXT = r.document_type::TEXT
            OR (r.document_type::TEXT = 'CNH_EAR' AND d.document_type::TEXT = 'CNH')
            OR (r.document_type::TEXT = 'CREDENTIAL_DETRAN_SP' AND d.document_type::TEXT = 'CREDENTIAL_DETRAN')
          )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_instructor_global_compliance_valid(UUID, public.vehicle_category)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_instructor_global_compliance_valid(UUID, public.vehicle_category)
  TO authenticated, service_role;
