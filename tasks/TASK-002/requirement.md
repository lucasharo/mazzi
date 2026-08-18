# Requirement — TASK-002

TASK: TASK-002  
STATUS: PRODUCT_READY  
OWNER: MAZZI Product  
LAST_UPDATED: 2026-08-18  

---

# 1. Objetivo
Executar uma correção técnica cirúrgica na infraestrutura Supabase do MAZZI para:
1. Eliminar a duplicação de sobrecargas (overloads) da função RPC `update_my_profile` no Supabase remoto, consolidando-a em uma **única assinatura canônica com endurecimento de segurança (`SECURITY DEFINER`, `search_path = public, pg_temp`, `RETURNS void`, `REVOKE ALL FROM PUBLIC/anon` e `GRANT EXECUTE TO authenticated, service_role`)**.
2. Reconciliar e reparar o histórico oficial de migrations (`supabase_migrations.schema_migrations`) no banco remoto Supabase (`bhvpkgonhlujmxvwnxix`), registrando com precisão as migrations `20260817000027` a `20260818000032` sem reexecutar DDLs já aplicados.
3. Remover o script temporário `scripts/apply-student-identity-migration.ts` que aplicava DDLs sem o devido registro no ledger oficial de migrations.

---

# 2. Requisitos Não-Funcionais e Segurança

- **Sem Alteração de UX ou Regras de Produto**: Nenhuma mudança no formulário, telas, cards ou fluxos visuais do App Aluno.
- **Proteção Total contra Vazamento de Dados**: A RPC `update_my_profile` deve ter retorno `RETURNS void` para evitar expor `cpf`, `metadata`, `role`, `status` ou a linha inteira da tabela `users` no payload de resposta HTTP.
- **Princípio do Menor Privilégio (RBAC / Grants)**:
  - `PUBLIC`: `EXECUTE` revogado.
  - `anon`: `EXECUTE` revogado.
  - `authenticated`: `EXECUTE` permitido.
  - `service_role`: `EXECUTE` permitido.
- **Hardening de search_path**: `SET search_path = public, pg_temp` para evitar vulnerabilidades de schema hijacking em funções `SECURITY DEFINER`.
- **Assinaturas Antigas (Overloads) Eliminadas**: As assinaturas de 2 e 3 parâmetros (`update_my_profile(text, text)` e `update_my_profile(text, text, text)`) devem ser completamente removidas.

---

# 3. Critérios de Aceite

- **AC01**: Apenas UMA assinatura da RPC `update_my_profile` existe no schema `public` do PostgreSQL: `update_my_profile(p_name text, p_phone text, p_avatar_url text, p_birth_date text) RETURNS void`.
- **AC02**: Chamadas à RPC `update_my_profile` por usuários não autenticados (`anon`) ou via `PUBLIC` são negadas com erro de permissão.
- **AC03**: A RPC `update_my_profile` possui `search_path = public, pg_temp` configurado e `SECURITY DEFINER`.
- **AC04**: A RPC `update_my_profile` deriva a identidade exclusivamente de `auth.uid()` e não aceita parâmetros de `cpf`, `user_id`, `role` ou `status`.
- **AC05**: O ledger de histórico `supabase_migrations.schema_migrations` no Supabase remoto contém com precisão todos os registros de versão das migrations `20260817000027` a `20260818000032`.
- **AC06**: O script de DDL bypass temporário `scripts/apply-student-identity-migration.ts` foi removido e a documentação ratifica o uso do mecanismo oficial do Supabase.
- **AC07**: Todos os portões de qualidade (`npm run lint`, `npm test`, `npm run build:all`) passam com 100% de sucesso.
- **AC08**: A suíte de testes de QA contra o Supabase remoto valida a rejeição de menores de 18 anos, imunidade a mutação de CPF e bloqueio de usuários anônimos.
