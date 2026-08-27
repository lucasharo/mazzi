-- `key` is also the name of the RPC output column. The previous function body
-- still used it as an unqualified ON CONFLICT target, which PL/pgSQL resolves
-- ambiguously at runtime. Recompile the current trusted function definition
-- with the concrete unique constraint name instead.
DO $$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_get_functiondef('public.update_admin_platform_configurations(jsonb)'::regprocedure)
    INTO v_definition;

  v_definition := replace(
    v_definition,
    'ON CONFLICT (key) DO UPDATE',
    'ON CONFLICT ON CONSTRAINT platform_configurations_key_key DO UPDATE'
  );

  EXECUTE v_definition;
END;
$$;
