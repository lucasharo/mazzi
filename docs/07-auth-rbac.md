# 07 — Autenticação, Autorização e RBAC (Supabase Auth + PostgreSQL RLS)

## 1. Modelo de Ameaça do Navegador & Limites de Confiança (Trust Boundaries)

No ecossistema MAZZI, estabelecemos a premissa de segurança de **Confiança Zero (Zero Trust) no cliente**:
1. **Frontend / TypeScript RBAC NÃO É Segurança:** Um usuário malicioso pode abrir o DevTools, inspecionar e extrair o seu JWT de sessão, emitir requisições REST diretamente para o Supabase ou chamar o SDK `supabase-js` em console manipulando payloads, chaves primárias e IDs de recursos.
2. **Defesa em Profundidade:** Toda e qualquer regra de negócio, isolamento multi-tenant, autorização de escrita e verificação de propriedade é garantida atômica e transacionalmente no **PostgreSQL através de Row Level Security (RLS)** e no **Backend Node/Express (Auth Guards)**.
3. **Imutabilidade de Permissões no Cliente:** Nenhuma role ou permissão enviada no corpo da requisição ou no `user_metadata` do Supabase Auth é considerada pelo backend.

---

## 2. Solução para Recursive RLS em `driving_school_staff`

### Diagnóstico do Risco
A política ingênua original:
```sql
-- ❌ VULNERABILIDADE: RLS Recursivo / Infinite Recursion
CREATE POLICY "School staff can view same school members" ON driving_school_staff
  FOR SELECT TO authenticated
  USING (
    school_id IN (
      SELECT school_id FROM driving_school_staff WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );
```
Essa construção gerava recursão infinita na avaliação de políticas do PostgreSQL sobre a própria tabela protegida.

### Solução Adotada (Migration `20260814000003_auth_security_hardening.sql`)
Criação de funções auxiliares puras, com `SECURITY DEFINER`, `search_path` fixo e estrito:
```sql
CREATE OR REPLACE FUNCTION public.is_school_member(target_school_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.driving_school_staff
    WHERE school_id = target_school_id
      AND user_id = auth.uid()
      AND is_active = TRUE
  );
$$;
```
A política em `driving_school_staff` passa a consumir a função sem subqueries autorreferenciais recursivas.

---

## 3. Gestão Rigorosa de Contas Bloqueadas (`status = 'BLOCKED'`)

### Regra Crítica
Um usuário bloqueado (`users.status = 'BLOCKED'`) **não pode continuar operando** diretamente pelo Supabase REST mesmo que possua um JWT emitido com expiração futura.

### Implementação de Banco
Helper central `is_current_user_active()`:
```sql
CREATE OR REPLACE FUNCTION public.is_current_user_active()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND status = 'ACTIVE'
  );
$$;
```
Todas as políticas de RLS (`users`, `bookings`, `driving_school_staff`, `service_offerings`, `payments`) incluem `is_current_user_active()` em suas cláusulas `USING` e `WITH CHECK`. Se o status mudar para `BLOCKED`, qualquer consulta via Supabase Browser Client falha imediatamente com `403/Empty Result`.

---

## 4. Política de Usuários Suspensos

`[DECISION_PENDING_SUSPENDED_ACCESS_POLICY]`
- Usuários com status `SUSPENDED` têm criação de novas reservas, publicação de ofertas e gestão de horários bloqueados.
- A política detalhada de acesso de leitura a históricos prévios e extratos passados está aguardando alinhamento regulatório/comercial. Por segurança, aplica-se o princípio do menor privilégio.

---

## 5. Proteção de Tabelas de Autorização contra Ataque Direto

| Tabela | Leitura (SELECT) | Escrita (INSERT/UPDATE/DELETE) | Defesa RLS |
| :--- | :--- | :--- | :--- |
| `user_roles` | Próprio usuário (`user_id = auth.uid()`) ou `PLATFORM_ADMIN` | **BLOQUEADA** para `authenticated` / `anon` | Apenas `service_role` ou triggers de backend |
| `role_permissions` | Aberta para leitura de catálogo (`USING (true)`) | **BLOQUEADA** para todos os clientes públicos | Somente migrations / `service_role` |
| `user_custom_permissions` | Próprio usuário ou `PLATFORM_ADMIN` | **BLOQUEADA** para `authenticated` / `anon` | Apenas fluxos administrativos com `AuditLog` |

---

## 6. Fluxo de Provisionamento (`auth.users` ↔ `public.users`)

O provisionamento de identidades ocorre de forma atômica e confiável através de trigger transacional de banco de dados (`on_auth_user_created`):
1. Usuário realiza signup no Supabase Auth.
2. Trigger `handle_new_auth_user()` é disparada com privilégio controlado `SECURITY DEFINER`.
3. Insere registro correspondente em `public.users` com `id = NEW.id`, `status = 'ACTIVE'` e `role = 'STUDENT'`.
4. Insere papel inicial em `public.user_roles` estritamente como `'STUDENT'`.
5. **Prevenção de Escalada de Privilégios:** A trigger ignora quaisquer parâmetros de `role` ou `is_admin` passados em `raw_user_meta_data`.

---

## 7. Inventário de Funções `SECURITY DEFINER`

| Função | Finalidade | Search Path | Inputs | Outputs | Permissão EXECUTE |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `public.is_current_user_active()` | Valida status ativo em `users` para RLS | `public, pg_temp` | Nenhum | `BOOLEAN` | `authenticated` |
| `public.is_school_member(UUID)` | Valida vínculo com CFC sem recursão | `public, pg_temp` | `target_school_id` | `BOOLEAN` | `authenticated` |
| `public.is_school_admin(UUID)` | Valida se é gestor do CFC | `public, pg_temp` | `target_school_id` | `BOOLEAN` | `authenticated` |
| `public.is_platform_admin()` | Valida se é admin da plataforma | `public, pg_temp` | Nenhum | `BOOLEAN` | `authenticated` |
| `public.handle_new_auth_user()` | Trigger de auto-provisionamento de usuário | `public, pg_temp` | `TRIGGER (NEW)` | `TRIGGER` | Interno do PostgreSQL |

---

## 8. Separação de Dados Públicos e Privados (Data Boundary)

Para evitar exposição de dados sensíveis de prestadores e alunos no marketplace:
- **View Pública Sanitizada (`providers_public_view`):**
  - Campos expostos: `id`, `user_id`, `provider_name`, `avatar_url`, `category`, `bio`, `profile_picture_url`, `rating`, `total_reviews`, `total_lessons_completed`, `operating_zones`, `is_verified`, `status`.
  - Campos mascarados e estritamente inacessíveis publicamente: CPF, RG, CNH, CRLV, RENAVAM, dados bancários/PIX, relatórios internos de compliance e notas administrativas.

---

## 9. Isolamento do `SUPABASE_SERVICE_ROLE_KEY`

- A chave `SUPABASE_SERVICE_ROLE_KEY` **nunca** é compilada no bundle cliente (proibido prefixo `VITE_`).
- A função `getSupabaseAdminClient()` possui guarda ativa em tempo de execução:
  ```typescript
  if (typeof window !== 'undefined') {
    throw new Error('SECURITY VIOLATION: getSupabaseAdminClient called in browser environment!');
  }
  ```
- Clientes web utilizam exclusivamente `supabaseBrowserClient` com `VITE_SUPABASE_ANON_KEY` restrito por RLS.

---

## 10. Matriz de Simulação de Ataques Diretos ao Supabase

| Vetor de Ataque | Cenário | Resultado Esperado | Validação |
| :--- | :--- | :--- | :--- |
| **Ataque A (Anti-IDOR)** | Aluno A tenta ler/alterar perfil do Aluno B via REST | **DENIED (403 / 0 rows)** | Teste automatizado + RLS `auth.uid() = id` |
| **Ataque B (Escalação de Role)** | Aluno tenta fazer `INSERT INTO user_roles` com `PLATFORM_ADMIN` | **DENIED (403)** | Teste automatizado + RLS default deny |
| **Ataque C (Escalação de Permissão)** | Aluno tenta fazer `INSERT INTO user_custom_permissions` | **DENIED (403)** | Teste automatizado + RLS default deny |
| **Ataque D (Multi-Tenant CFC)** | Gestor do CFC A tenta consultar equipe/frota do CFC B | **DENIED (403 / 0 rows)** | Teste automatizado + RLS `is_school_member()` |
| **Ataque E (Isolamento de Prestador)** | Instrutor A tenta modificar veículo ou agenda do Instrutor B | **DENIED (403 / 0 rows)** | Teste automatizado + RLS `provider_id` check |
| **Ataque F (Menor Privilégio)** | Agente de Suporte tenta alterar permissões ou solicitar payout | **DENIED (403)** | Teste automatizado + RBAC Matrix |
| **Ataque G (Revogação Imediata)** | Usuário `BLOCKED` com JWT não expirado tenta criar booking | **DENIED (403 / 0 rows)** | Teste automatizado + RLS `is_current_user_active()` |

---

## 11. Classificação do Status de Testes RLS

- **STATIC_RLS_VALIDATION:** **APROVADO** (Sintaxe SQL, políticas de exclusão e triggers validados).
- **UNIT_RBAC_VALIDATION:** **APROVADO** (14 cenários e suíte completa em `tests/auth-rbac.test.ts`).
- **REAL_RLS_INTEGRATION:** **RLS_DATABASE_TEST_PENDING** *(Gate obrigatório mantido para execução contra contêiner live de PostgreSQL/Supabase antes da Sprint 08)*.

As RPCs do ciclo Autoescola ↔ Instrutor validam autenticação, papel/permissão e tenant no banco. Convites, vínculos, compliance e ativação não dependem de escrita direta confiável pelo frontend.
