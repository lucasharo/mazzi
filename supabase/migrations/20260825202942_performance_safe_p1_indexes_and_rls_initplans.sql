-- Safe P1 performance hardening.
-- These indexes cover foreign-key columns reported by the Performance Advisor.
-- The policy rewrites preserve the predicates exactly while allowing Postgres to
-- evaluate stable auth helpers once per statement instead of once per row.

CREATE INDEX IF NOT EXISTS idx_cancellation_policy_rules_policy_id
  ON public.cancellation_policy_rules (policy_id);

CREATE INDEX IF NOT EXISTS idx_driving_school_staff_ended_by
  ON public.driving_school_staff (ended_by);

CREATE INDEX IF NOT EXISTS idx_driving_school_staff_source_invitation_id
  ON public.driving_school_staff (source_invitation_id);

CREATE INDEX IF NOT EXISTS idx_driving_school_staff_suspended_by
  ON public.driving_school_staff (suspended_by);

CREATE INDEX IF NOT EXISTS idx_platform_configurations_updated_by
  ON public.platform_configurations (updated_by);

CREATE INDEX IF NOT EXISTS idx_providers_approved_by
  ON public.providers (approved_by);

CREATE INDEX IF NOT EXISTS idx_providers_rejected_by
  ON public.providers (rejected_by);

CREATE INDEX IF NOT EXISTS idx_user_custom_permissions_granted_by
  ON public.user_custom_permissions (granted_by);

ALTER POLICY "Providers can insert own compliance documents"
  ON public.compliance_documents
  WITH CHECK (
    is_current_user_active()
    AND (is_provider_owner(provider_id) OR user_id = (select auth.uid()))
    AND (
      status = ANY (ARRAY['PENDING'::public.compliance_status, 'IN_REVIEW'::public.compliance_status])
      OR (
        document_type = 'MAZZI_TERMS_ACCEPTANCE'::public.compliance_doc_type
        AND status = 'APPROVED'::public.compliance_status
        AND storage_path::text LIKE 'acceptance://mazzi-ethics/%'
      )
    )
  );

ALTER POLICY "Providers can read own compliance documents"
  ON public.compliance_documents
  USING (
    is_current_user_active()
    AND (
      is_provider_owner(provider_id)
      OR user_id = (select auth.uid())
      OR is_compliance_reviewer()
    )
  );

ALTER POLICY "Users can view own custom permissions"
  ON public.user_custom_permissions
  USING ((select auth.uid()) = user_id OR is_platform_admin());

ALTER POLICY "Parties can read own payments"
  ON public.payments
  USING (
    is_current_user_active()
    AND (
      booking_id IN (
        SELECT bookings.id
        FROM public.bookings
        WHERE bookings.student_id = (select auth.uid())
           OR bookings.instructor_id = (select auth.uid())
      )
      OR is_platform_admin()
    )
  );

ALTER POLICY "Providers can create initial draft profile"
  ON public.providers
  WITH CHECK (
    is_current_user_active()
    AND user_id = (select auth.uid())
    AND status = 'DRAFT'::public.provider_status
  );

ALTER POLICY offerings_owner_select
  ON public.service_offerings
  USING (
    is_current_user_active()
    AND (
      provider_id IN (
        SELECT p.id
        FROM public.providers AS p
        WHERE p.user_id = (select auth.uid())
      )
      OR is_school_admin(provider_id)
      OR is_platform_admin()
    )
  );

ALTER POLICY "Authenticated users can create own student profile"
  ON public.users
  WITH CHECK (
    (id = (select auth.uid()))
    AND role = 'STUDENT'::public.user_role
    AND status = 'ACTIVE'::public.user_status
    AND lower(email::text) = lower(COALESCE(((select auth.jwt()) ->> 'email'::text), ''::text))
    AND cpf IS NOT NULL
    AND length(cpf::text) = 11
    AND validate_cpf(cpf::text)
    AND birth_date IS NOT NULL
    AND birth_date <= (CURRENT_DATE - '18 years'::interval)
  );
