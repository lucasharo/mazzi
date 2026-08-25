-- R10C: promote eligible instructor providers after either USER_GLOBAL or
-- provider-scoped compliance approval, with accurate lifecycle audit values.
BEGIN;

CREATE OR REPLACE FUNCTION public.promote_eligible_instructor_provider()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_candidate public.providers;
BEGIN
  IF NEW.status <> 'APPROVED'::public.compliance_status THEN
    RETURN NEW;
  END IF;

  IF NEW.scope = 'PROVIDER'::public.compliance_document_scope
     AND NEW.provider_id IS NOT NULL THEN
    SELECT p.*
      INTO v_candidate
      FROM public.providers p
     WHERE p.id = NEW.provider_id
       AND p.type = 'INSTRUCTOR'::public.provider_type
       AND p.status IN ('DRAFT'::public.provider_status, 'PENDING_REVIEW'::public.provider_status)
     FOR UPDATE;

    IF FOUND AND public.is_provider_activation_eligible(v_candidate.id) THEN
      UPDATE public.providers
         SET status = 'ACTIVE'::public.provider_status,
             approved_at = COALESCE(approved_at, NOW()),
             updated_at = NOW()
       WHERE id = v_candidate.id;

      INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id,
                                    previous_value, new_value, created_at)
      VALUES (NEW.reviewed_by, 'PROVIDER_AUTO_ACTIVATED', 'Provider', v_candidate.id::text,
              jsonb_build_object('status', v_candidate.status),
              jsonb_build_object('status', 'ACTIVE'), NOW());
    END IF;
  ELSIF NEW.scope = 'USER_GLOBAL'::public.compliance_document_scope
        AND NEW.user_id IS NOT NULL THEN
    FOR v_candidate IN
      SELECT p.*
        FROM public.providers p
       WHERE p.user_id = NEW.user_id
         AND p.type = 'INSTRUCTOR'::public.provider_type
         AND p.status IN ('DRAFT'::public.provider_status, 'PENDING_REVIEW'::public.provider_status)
       FOR UPDATE
    LOOP
      IF public.is_provider_activation_eligible(v_candidate.id) THEN
        UPDATE public.providers
           SET status = 'ACTIVE'::public.provider_status,
               approved_at = COALESCE(approved_at, NOW()),
               updated_at = NOW()
         WHERE id = v_candidate.id;

        INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id,
                                      previous_value, new_value, created_at)
        VALUES (NEW.reviewed_by, 'PROVIDER_AUTO_ACTIVATED', 'Provider', v_candidate.id::text,
                jsonb_build_object('status', v_candidate.status),
                jsonb_build_object('status', 'ACTIVE'), NOW());
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.promote_eligible_instructor_provider() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS promote_eligible_instructor_provider_after_compliance
  ON public.compliance_documents;

CREATE TRIGGER promote_eligible_instructor_provider_after_compliance
AFTER INSERT OR UPDATE OF status, provider_id, scope, user_id
ON public.compliance_documents
FOR EACH ROW
EXECUTE FUNCTION public.promote_eligible_instructor_provider();

COMMIT;
