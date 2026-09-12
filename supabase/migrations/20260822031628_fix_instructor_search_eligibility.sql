-- MAZZI — Align instructor search eligibility with canonical compliance types.
-- Keep legacy CNH/DETRAN values readable while preferring canonical values.

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
      WHERE u.id = p_user_id
        AND u.status = 'ACTIVE'
        AND (u.role = 'INSTRUCTOR' OR EXISTS (
          SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id AND ur.role = 'INSTRUCTOR'
        ))
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
          LEFT JOIN public.providers lp ON lp.id = d.provider_id
          WHERE d.status = 'APPROVED'
            AND (d.expires_at IS NULL OR d.expires_at > NOW())
            AND (
              d.document_type::TEXT = r.document_type::TEXT
              OR (r.document_type::TEXT = 'CNH_EAR' AND d.document_type::TEXT = 'CNH')
              OR (r.document_type::TEXT = 'CREDENTIAL_DETRAN_SP' AND d.document_type::TEXT = 'CREDENTIAL_DETRAN')
            )
            AND (
              (d.scope = 'USER_GLOBAL'::public.compliance_document_scope AND d.user_id = p_user_id)
              OR (d.scope = 'PROVIDER'::public.compliance_document_scope AND lp.type = 'INSTRUCTOR' AND lp.user_id = p_user_id)
            )
        )
    )
  );
$$;

REVOKE ALL ON FUNCTION public.is_instructor_global_compliance_valid(UUID, public.vehicle_category) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_instructor_global_compliance_valid(UUID, public.vehicle_category) TO authenticated, service_role;

-- The Honda City is an automatic vehicle; align its offering so the public
-- search join does not discard it for a transmission mismatch.
UPDATE public.service_offerings
SET transmission = 'AUTOMATIC'::public.vehicle_transmission,
    updated_at = NOW()
WHERE id = '02d4c38b-41a6-4cfd-9372-102c2ac3dfae'::UUID
  AND vehicle_id = '51f76589-83ed-415b-9547-614ce3e4b8d7'::UUID
  AND provider_id = '48444dc7-39ee-428e-8fcd-8546f53e30ee'::UUID
  AND transmission = 'MANUAL'::public.vehicle_transmission;
