-- MAZZI — compliance runtime gates and secure school lifecycle RPCs
-- Forward-only. This migration is intentionally independent from UI code.

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
    SELECT 1 FROM public.users u
    WHERE u.id = p_user_id
      AND u.status = 'ACTIVE'
      AND (u.role = 'INSTRUCTOR' OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = u.id AND ur.role = 'INSTRUCTOR'
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
        LEFT JOIN public.providers legacy_provider ON legacy_provider.id = d.provider_id
        WHERE d.status = 'APPROVED'
          AND (d.expires_at IS NULL OR d.expires_at > NOW())
          AND (
            (d.scope = 'USER_GLOBAL'::public.compliance_document_scope
             AND d.user_id = p_user_id)
            OR
            (d.scope = 'PROVIDER'::public.compliance_document_scope
             AND legacy_provider.type = 'INSTRUCTOR'
             AND legacy_provider.user_id = p_user_id
             AND (d.document_type::TEXT = CASE r.document_type
               WHEN 'CNH_EAR' THEN 'CNH'
               WHEN 'CREDENTIAL_DETRAN_SP' THEN 'CREDENTIAL_DETRAN'
               ELSE r.document_type END))
          )
          AND d.document_type::TEXT = CASE r.document_type
            WHEN 'CNH_EAR' THEN 'CNH'
            WHEN 'CREDENTIAL_DETRAN_SP' THEN 'CREDENTIAL_DETRAN'
            ELSE r.document_type END
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_membership_compliance_valid(
  p_membership_id UUID,
  p_category public.vehicle_category DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.driving_school_staff dss
    WHERE dss.id = p_membership_id
      AND NOT EXISTS (
        SELECT 1 FROM public.compliance_requirements r
        WHERE r.scope = 'MEMBERSHIP'::public.compliance_document_scope
          AND r.is_mandatory IS TRUE
          AND (p_category IS NULL OR r.category IS NULL OR r.category = p_category)
          AND (r.effective_from IS NULL OR r.effective_from <= NOW())
          AND (r.effective_to IS NULL OR r.effective_to >= NOW())
          AND r.regulatory_status NOT IN ('SUPERSEDED', 'INACTIVE')
          AND NOT EXISTS (
            SELECT 1 FROM public.compliance_documents d
            WHERE d.membership_id = p_membership_id
              AND d.scope = 'MEMBERSHIP'::public.compliance_document_scope
              AND d.document_type::TEXT = r.document_type
              AND d.status = 'APPROVED'
              AND (d.expires_at IS NULL OR d.expires_at > NOW())
          )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_provider_instructor_eligible(
  p_provider_id UUID,
  p_instructor_id UUID,
  p_category public.vehicle_category DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.providers p
    JOIN public.users u ON u.id = p_instructor_id AND u.status = 'ACTIVE'
    WHERE p.id = p_provider_id
      AND p.status = 'ACTIVE'
      AND (u.role = 'INSTRUCTOR' OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = u.id AND ur.role = 'INSTRUCTOR'
      ))
      AND public.is_instructor_global_compliance_valid(p_instructor_id, p_category)
      AND (
        (p.type = 'INSTRUCTOR' AND p.user_id = p_instructor_id)
        OR
        (p.type = 'DRIVING_SCHOOL' AND EXISTS (
          SELECT 1 FROM public.driving_school_staff dss
          WHERE dss.school_id = p.id
            AND dss.user_id = p_instructor_id
            AND dss.role = 'INSTRUCTOR'
            AND dss.membership_status = 'ACTIVE'
            AND dss.is_active IS TRUE
            AND public.is_membership_compliance_valid(dss.id, p_category)
        ))
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_instructor_global_compliance_valid(UUID, public.vehicle_category) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_membership_compliance_valid(UUID, public.vehicle_category) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_provider_instructor_eligible(UUID, UUID, public.vehicle_category) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_instructor_global_compliance_valid(UUID, public.vehicle_category) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_membership_compliance_valid(UUID, public.vehicle_category) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_provider_instructor_eligible(UUID, UUID, public.vehicle_category) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.list_my_global_compliance()
RETURNS SETOF public.compliance_documents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  RETURN QUERY SELECT d.* FROM public.compliance_documents d
  WHERE d.scope = 'USER_GLOBAL'::public.compliance_document_scope
    AND d.user_id = auth.uid()
  ORDER BY d.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_my_global_compliance_document(
  p_document_type public.compliance_doc_type,
  p_storage_path TEXT,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS public.compliance_documents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE v_doc public.compliance_documents;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT public.is_current_user_active() THEN RAISE EXCEPTION 'USER_NOT_ACTIVE'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'INSTRUCTOR')
     AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'INSTRUCTOR') THEN
    RAISE EXCEPTION 'INSTRUCTOR_ROLE_REQUIRED';
  END IF;
  INSERT INTO public.compliance_documents (
    provider_id, user_id, vehicle_id, membership_id, scope, document_type,
    storage_path, status, expires_at
  ) VALUES (
    NULL, auth.uid(), NULL, NULL, 'USER_GLOBAL', p_document_type,
    p_storage_path, 'PENDING', p_expires_at
  ) RETURNING * INTO v_doc;
  RETURN v_doc;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_compliance_document(
  p_document_id UUID,
  p_status public.compliance_status,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS public.compliance_documents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE v_doc public.compliance_documents;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT public.is_compliance_reviewer() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_status NOT IN ('APPROVED', 'REJECTED') THEN RAISE EXCEPTION 'INVALID_REVIEW_STATUS'; END IF;
  UPDATE public.compliance_documents
  SET status = p_status, rejection_reason = CASE WHEN p_status = 'REJECTED' THEN p_rejection_reason ELSE NULL END,
      reviewed_by = auth.uid(), reviewed_at = NOW(), updated_at = NOW()
  WHERE id = p_document_id
  RETURNING * INTO v_doc;
  IF NOT FOUND THEN RAISE EXCEPTION 'DOCUMENT_NOT_FOUND'; END IF;
  RETURN v_doc;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_school_instructor_compliance_summary(
  p_school_id UUID
)
RETURNS TABLE (
  instructor_id UUID,
  instructor_name TEXT,
  membership_id UUID,
  membership_status public.school_membership_status,
  global_compliance_valid BOOLEAN,
  membership_compliance_valid BOOLEAN,
  overall_eligible BOOLEAN,
  valid_until TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT public.is_school_admin(p_school_id) AND NOT public.is_compliance_reviewer() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  RETURN QUERY
  SELECT dss.user_id, u.name::TEXT, dss.id, dss.membership_status,
    public.is_instructor_global_compliance_valid(dss.user_id, NULL),
    public.is_membership_compliance_valid(dss.id, NULL),
    (dss.membership_status = 'ACTIVE' AND dss.is_active AND public.is_instructor_global_compliance_valid(dss.user_id, NULL)
      AND public.is_membership_compliance_valid(dss.id, NULL)),
    (SELECT MIN(d.expires_at) FROM public.compliance_documents d
     WHERE d.user_id = dss.user_id AND d.status = 'APPROVED' AND d.expires_at IS NOT NULL)
  FROM public.driving_school_staff dss JOIN public.users u ON u.id = dss.user_id
  WHERE dss.school_id = p_school_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_my_school_invitations()
RETURNS SETOF public.driving_school_invitations
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
  SELECT i.* FROM public.driving_school_invitations i
  JOIN public.users u ON u.id = auth.uid()
  WHERE auth.uid() IS NOT NULL
    AND i.status = 'PENDING'
    AND (i.target_user_id = auth.uid() OR (i.target_user_id IS NULL AND LOWER(BTRIM(i.invited_email)) = LOWER(BTRIM(u.email))))
  ORDER BY i.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.list_my_global_compliance() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_my_global_compliance_document(public.compliance_doc_type, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_compliance_document(UUID, public.compliance_status, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_school_instructor_compliance_summary(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_my_school_invitations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_global_compliance() TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_my_global_compliance_document(public.compliance_doc_type, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_compliance_document(UUID, public.compliance_status, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_school_instructor_compliance_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_school_invitations() TO authenticated;
