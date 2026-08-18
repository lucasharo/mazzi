# Technical Plan — TASK-002

TASK: TASK-002  
STATUS: TECH_READY  
OWNER: MAZZI Tech Lead  
LAST_UPDATED: 2026-08-18  

---

# 1. Resumo Técnico
Este plano estabelece a estratégia técnica para eliminar as sobrecargas (overloads) da RPC `update_my_profile`, aplicar o endurecimento de segurança `SECURITY DEFINER` com `SET search_path = public, pg_temp` e `RETURNS void`, revogar acesso `PUBLIC`/`anon`, e reconciliar o histórico de migrations (`supabase_migrations.schema_migrations`) no Supabase remoto (`bhvpkgonhlujmxvwnxix`).

---

# 2. Matriz de Auditoria do Migration History (Supabase Remote `bhvpkgonhlujmxvwnxix`)

| Versão | Arquivo Local | Efeito Remoto Presente | Match Semântico | Registrado no History | Ação Necessária |
|---|---|---|---|---|---|
| `20260817000027` | `20260817000027_storage_avatars_bucket.sql` | SIM (Bucket `avatars`) | SIM | NÃO | Reconciliar Ledger (`INSERT`) |
| `20260817000028` | `20260817000028_fix_users_self_profile_rls.sql` | SIM (Policy `Users can update own profile`) | SIM | NÃO | Reconciliar Ledger (`INSERT`) |
| `20260817000029` | `20260817000029_add_user_cpf_and_birth_date.sql` | SIM (Colunas `cpf`, `birth_date`) | SIM | NÃO | Reconciliar Ledger (`INSERT`) |
| `20260817000030` | `20260817000030_check_user_email_exists.sql` | SIM (RPC `check_user_email_exists`) | SIM | NÃO | Reconciliar Ledger (`INSERT`) |
| `20260818000031` | `20260818000031_student_identity_mandatory_and_editable_birth_date.sql` | SIM (Trigger 18+ & Backfill Demo) | SIM | NÃO | Reconciliar Ledger (`INSERT`) |
| `20260818000032` | `20260818000032_harden_update_my_profile_and_reconcile_migrations.sql` | NOVO | SIM | NOVO | Aplicar DDL e `INSERT` no Ledger |

---

# 3. Arquivos Afetados

- **[NEW]** [`supabase/migrations/20260818000032_harden_update_my_profile_and_reconcile_migrations.sql`](file:///d:/mazzi_premium_ui_v2/supabase/migrations/20260818000032_harden_update_my_profile_and_reconcile_migrations.sql)
- **[DELETE]** `scripts/apply-student-identity-migration.ts`
- **[DELETE]** `scripts/inspect-users-audit-matrix.ts`
- **[DELETE]** `scripts/inspect-rpc-and-migrations-drift.ts`
- **[DELETE]** `scripts/inspect-migrations-matrix.ts`
- **[NEW]** [`scripts/apply-migration-32-and-reconcile.ts`](file:///d:/mazzi_premium_ui_v2/scripts/apply-migration-32-and-reconcile.ts)
- **[NEW]** [`tests/rpc-security-and-migration-history.test.ts`](file:///d:/mazzi_premium_ui_v2/tests/rpc-security-and-migration-history.test.ts)

---

# 4. Estratégia de Implementação da Migration `20260818000032`

```sql
-- ============================================================================
-- MAZZI PLATFORM — HARDEN update_my_profile RPC & RECONCILE MIGRATION HISTORY
-- Migration: 20260818000032_harden_update_my_profile_and_reconcile_migrations.sql
-- ============================================================================

-- 1. DROP ALL OLD OVERLOADS OF update_my_profile
DROP FUNCTION IF EXISTS public.update_my_profile(text, text);
DROP FUNCTION IF EXISTS public.update_my_profile(text, text, text);
DROP FUNCTION IF EXISTS public.update_my_profile(text, text, text, text);

-- 2. CREATE CANONICAL SINGLE RPC update_my_profile WITH HARDENED SECURITY
CREATE OR REPLACE FUNCTION public.update_my_profile(
  p_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL,
  p_birth_date TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_user_role user_role;
  v_parsed_birth_date DATE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Usuário não autenticado.';
  END IF;

  SELECT role INTO v_user_role FROM public.users WHERE id = v_user_id AND deleted_at IS NULL;
  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'USER_NOT_FOUND: Perfil de usuário não encontrado.';
  END IF;

  -- Parse birth_date if provided
  IF p_birth_date IS NOT NULL AND trim(p_birth_date) != '' THEN
    BEGIN
      v_parsed_birth_date := p_birth_date::DATE;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'INVALID_BIRTH_DATE_FORMAT: Data de nascimento em formato inválido.';
    END;
  END IF;

  -- Update fields for authenticated user
  UPDATE public.users
  SET
    name = COALESCE(NULLIF(trim(p_name), ''), name),
    phone = COALESCE(NULLIF(trim(p_phone), ''), phone),
    avatar_url = CASE WHEN p_avatar_url IS NOT NULL THEN p_avatar_url ELSE avatar_url END,
    birth_date = CASE WHEN v_parsed_birth_date IS NOT NULL THEN v_parsed_birth_date ELSE birth_date END,
    updated_at = NOW()
  WHERE id = v_user_id;
END;
$$;

-- 3. PERMISSION HARDENING (REVOKE FROM PUBLIC/ANON, GRANT TO AUTHENTICATED & SERVICE_ROLE)
REVOKE ALL ON FUNCTION public.update_my_profile(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_my_profile(TEXT, TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_my_profile(TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- 4. RECONCILE MIGRATION HISTORY LEDGER IN supabase_migrations.schema_migrations
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES 
  ('20260817000027', 'storage_avatars_bucket'),
  ('20260817000028', 'fix_users_self_profile_rls'),
  ('20260817000029', 'add_user_cpf_and_birth_date'),
  ('20260817000030', 'check_user_email_exists'),
  ('20260818000031', 'student_identity_mandatory_and_editable_birth_date'),
  ('20260818000032', 'harden_update_my_profile_and_reconcile_migrations')
ON CONFLICT (version) DO NOTHING;
```

---

# 5. Instruções para o MAZZI Dev
- Crie e aplique a migration `20260818000032_harden_update_my_profile_and_reconcile_migrations.sql`.
- Remova o script temporário de bypass DDL.
- Execute os testes de QA da matriz A a N contra o Supabase remoto.
- Execute `npm run lint`, `npm test`, `npm run build:all`.
