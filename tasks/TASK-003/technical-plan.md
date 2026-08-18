# TASK-003 — Plano Técnico de Engenharia: Recuperação de Senha Anti-Enumeração

**Versão**: 1.0  
**Data**: 2026-08-18  
**Autor**: MAZZI Tech Lead  
**Status**: `APROVADO`

---

## 1. Arquitetura e Estratégia de Mudança

### 1.1. Modificações no Frontend (`src/components/auth/AppLogin.tsx`)
- Remover a chamada `await checkUserEmailExists(email.trim())`.
- Ao submeter o formulário de recuperação com um e-mail sintaticamente válido:
  - Invocar diretamente `requestPasswordReset(email.trim())`.
  - Definir feedback público com a mensagem canônica: `"Se existir uma conta associada a este e-mail, enviaremos um código de recuperação."`
  - Transicionar o estado para a tela `'recovery_otp'`.
  - Se ocorrer um erro técnico real de infraestrutura, tratar amigavelmente sem expor status de conta.

### 1.2. Modificações no AuthService (`src/lib/auth-service.ts`)
- Remover a função exportada `checkUserEmailExists`.

### 1.3. Migration Supabase (`supabase/migrations/20260818000033_disable_email_account_enumeration.sql`)
- Executar `DROP FUNCTION IF EXISTS public.check_user_email_exists(text);`.
- Reconciliar o ledger na tabela `supabase_migrations.schema_migrations` inserindo o registro da versão `20260818000033`.

### 1.4. Atualização de Documentação e Decisões de Produto
- `docs/product/PRODUCT_DECISIONS.md`: Atualizar decisão legada para `SUPERSEDED` e registrar `DEC-011`.
- `docs/CURRENT_IMPLEMENTATION_STATUS.md`: Atualizar status do módulo de recuperação para `Recuperação de senha anti-enumeração -> IMPLEMENTADO`.

---

## 2. Ordem de Execução

1. Criar migration `20260818000033_disable_email_account_enumeration.sql`.
2. Aplicar migration no Supabase remoto e sincronizar ledger.
3. Atualizar `src/lib/auth-service.ts` e `src/components/auth/AppLogin.tsx`.
4. Atualizar testes unitários e adicionar suíte de integração de anti-enumeração em `tests/auth-anti-enumeration.test.ts`.
5. Atualizar documentação (`PRODUCT_DECISIONS.md`, `CURRENT_IMPLEMENTATION_STATUS.md`).
6. Executar portões de qualidade (`npm run lint`, `npm test`, `npm run build:all`).
