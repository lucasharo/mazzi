-- Generic audit coverage for business data mutations.
CREATE OR REPLACE FUNCTION public.audit_business_mutation()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_old jsonb := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
  v_new jsonb := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE '{}'::jsonb END;
  v_entity_id text := COALESCE(v_new->>'id', v_old->>'id', v_new->>'uuid', v_old->>'uuid', 'unknown');
BEGIN
  INSERT INTO public.audit_logs(
    id, actor_id, action, entity_type, entity_id, previous_value, new_value, created_at
  ) VALUES (
    gen_random_uuid(), v_actor,
    'AUDIT_' || TG_OP || '_' || upper(TG_TABLE_NAME),
    initcap(replace(TG_TABLE_NAME, '_', ' ')),
    v_entity_id,
    v_old,
    v_new,
    now()
  );
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'users', 'providers', 'vehicles', 'service_offerings', 'bookings',
    'quotes', 'payments', 'compliance_documents', 'reviews',
    'availabilities', 'instructor_global_blocks', 'driving_school_staff',
    'driving_school_membership_events', 'platform_configurations'
  ] LOOP
    IF to_regclass('public.' || v_table) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_business_mutation ON public.%I', v_table);
      EXECUTE format('CREATE TRIGGER trg_audit_business_mutation AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_business_mutation()', v_table);
    END IF;
  END LOOP;
END;
$$;
