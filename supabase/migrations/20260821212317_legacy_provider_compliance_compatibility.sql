-- MAZZI — grandfather pre-scope active autonomous providers
-- Existing active autonomous providers without document rows remain operable
-- while the global compliance upload/review flow is rolled out. New providers
-- and all school memberships still require the objective document gates.

CREATE OR REPLACE FUNCTION public.is_instructor_global_compliance_valid(
  p_user_id UUID,
  p_category public.vehicle_category DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.providers legacy
    WHERE legacy.type = 'INSTRUCTOR'
      AND legacy.user_id = p_user_id
      AND legacy.status = 'ACTIVE'
      AND legacy.created_at < TIMESTAMPTZ '2026-08-21 21:30:00+00'
      AND NOT EXISTS (SELECT 1 FROM public.compliance_documents d WHERE d.provider_id = legacy.id)
  )
  OR (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = p_user_id AND u.status = 'ACTIVE'
        AND (u.role = 'INSTRUCTOR' OR EXISTS (
          SELECT 1 FROM public.user_roles ur WHERE ur.user_id=u.id AND ur.role='INSTRUCTOR'
        ))
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.compliance_requirements r
      WHERE r.scope = 'USER_GLOBAL'::public.compliance_document_scope
        AND r.is_mandatory IS TRUE
        AND (p_category IS NULL OR r.category IS NULL OR r.category=p_category)
        AND (r.effective_from IS NULL OR r.effective_from<=NOW())
        AND (r.effective_to IS NULL OR r.effective_to>=NOW())
        AND r.regulatory_status NOT IN ('SUPERSEDED','INACTIVE')
        AND NOT EXISTS (
          SELECT 1 FROM public.compliance_documents d
          LEFT JOIN public.providers lp ON lp.id=d.provider_id
          WHERE d.status='APPROVED' AND (d.expires_at IS NULL OR d.expires_at>NOW())
            AND d.document_type::TEXT = CASE r.document_type
              WHEN 'CNH_EAR' THEN 'CNH'
              WHEN 'CREDENTIAL_DETRAN_SP' THEN 'CREDENTIAL_DETRAN'
              ELSE r.document_type END
            AND ((d.scope='USER_GLOBAL' AND d.user_id=p_user_id)
              OR (d.scope='PROVIDER' AND lp.type='INSTRUCTOR' AND lp.user_id=p_user_id))
        )
    )
  );
$$;
