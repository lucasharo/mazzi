-- R10B: make the existing instructor eligibility contract understand
-- approved documents stored in USER_GLOBAL or in the instructor's own PROVIDER.
DROP FUNCTION public.is_instructor_global_compliance_valid(uuid, public.vehicle_category);

CREATE OR REPLACE FUNCTION public.is_instructor_global_compliance_valid(
  p_user_id uuid, p_category public.vehicle_category)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.providers legacy
    WHERE legacy.type='INSTRUCTOR'::public.provider_type
      AND legacy.user_id=p_user_id
      AND legacy.status='ACTIVE'::public.provider_status
      AND legacy.created_at<TIMESTAMPTZ '2026-08-21 21:30:00+00'
      AND NOT EXISTS (
        SELECT 1 FROM public.compliance_documents d WHERE d.provider_id=legacy.id
      )
  ) OR (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id=p_user_id AND u.status='ACTIVE'
        AND (u.role='INSTRUCTOR'::public.user_role OR EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id=u.id AND ur.role='INSTRUCTOR'::public.user_role
        ))
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.compliance_requirements r
      WHERE r.scope='USER_GLOBAL'::public.compliance_document_scope
        AND r.is_mandatory IS TRUE
        AND (p_category IS NULL OR r.category IS NULL OR r.category=p_category)
        AND (r.effective_from IS NULL OR r.effective_from<=NOW())
        AND (r.effective_to IS NULL OR r.effective_to>=NOW())
        AND r.regulatory_status NOT IN ('SUPERSEDED','INACTIVE')
        AND NOT EXISTS (
          SELECT 1
          FROM public.compliance_documents d
          WHERE d.status='APPROVED'::public.compliance_status
            AND (d.expires_at IS NULL OR d.expires_at>NOW())
            AND (
              (d.scope='USER_GLOBAL'::public.compliance_document_scope
                AND d.user_id=p_user_id AND d.provider_id IS NULL)
              OR
              (d.scope='PROVIDER'::public.compliance_document_scope
                AND d.provider_id IN (
                  SELECT p.id FROM public.providers p
                  WHERE p.type='INSTRUCTOR'::public.provider_type AND p.user_id=p_user_id
                ))
            )
            AND (
              d.document_type::text=r.document_type::text
              OR (r.document_type::text='CNH_EAR' AND d.document_type::text='CNH')
              OR (r.document_type::text='CREDENTIAL_DETRAN_SP' AND d.document_type::text='CREDENTIAL_DETRAN')
            )
        )
    )
  );
$$;

REVOKE ALL ON FUNCTION public.is_instructor_global_compliance_valid(uuid,public.vehicle_category)
  FROM PUBLIC, anon, authenticated;
