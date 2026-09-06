# Technical Plan — TASK-092

TASK: TASK-092
STATUS: TECH_READY
OWNER: MAZZI Tech Lead
LAST_UPDATED: 2026-09-05

## 1. Resumo Técnico

Criar o componente reutilizável `NotificationPreferences` e um catálogo único de tipos, integrando-o aos perfis do Aluno e do PRO. Persistir preferências em tabela própria por usuário através de RPCs autenticadas. Um trigger `BEFORE INSERT` em `notifications` bloqueará apenas novos registros explicitamente desabilitados, mantendo a fonte da verdade no PostgreSQL e evitando alterações em cada produtor de notificação.

## 2. Código Existente Relacionado

- `src/types/index.ts`: contrato de `NotificationType` e `NotificationAppContext`.
- `src/lib/db-service.ts`: acesso Supabase centralizado.
- `src/apps/student/StudentApp.tsx`: Perfil do Aluno.
- `src/apps/provider/components/ProviderProfileTab.tsx`: Perfil do PRO.
- Triggers existentes de contexto, navegação e dispatch de push em `public.notifications`.

## 3. Arquivos Afetados

- [NEW] `src/lib/notification-preferences.ts`
- [NEW] `src/components/notifications/NotificationPreferences.tsx`
- [NEW] `supabase/migrations/20260906000000_task_092_notification_preferences.sql`
- [NEW] `supabase/migrations/20260906001000_task_092_notification_preferences_policy_hardening.sql`
- [NEW] `tasks/TASK-092/*`
- [MODIFY] `src/types/index.ts`
- [MODIFY] `src/lib/db-service.ts`
- [MODIFY] `src/apps/student/StudentApp.tsx`
- [MODIFY] `src/apps/provider/components/ProviderProfileTab.tsx`
- [MODIFY] `docs/CURRENT_IMPLEMENTATION_STATUS.md`

## 4. Banco de Dados & Migrations

- Criar `public.user_notification_preferences` com chave primária `(user_id, notification_type)`, `enabled`, timestamps e FK para `public.users`.
- Habilitar RLS e não expor a tabela diretamente ao cliente; usar RPCs com `auth.uid()`.
- Criar `get_my_notification_preferences()` e `set_my_notification_preference(text, boolean)` com `search_path` fixo, grants somente para `authenticated` e validação da lista canônica de tipos.
- Criar trigger seguro que retorna `NULL` apenas quando há preferência explicitamente desabilitada.
- Não modificar migrations aplicadas; a migration nova deve ser aplicada somente no Supabase DEV.

## 5. RLS e RBAC Afetados

As RPCs devem exigir sessão autenticada, usar exclusivamente `auth.uid()` e nunca aceitar `user_id` do cliente. A tabela fica com RLS habilitado e sem grants diretos para `anon`/`authenticated`. A função de trigger usa `SECURITY DEFINER` somente para a escrita interna, com `search_path = public, pg_temp` e sem exposição de execução ao cliente.

## 6. Estratégia de Implementação

1. Centralizar catálogo, labels, descrições, ícones e compatibilidade por contexto.
2. Adicionar métodos de leitura e gravação no `dbService`.
3. Implementar a migration com tabela, RPCs, grants e trigger.
4. Integrar o componente aos dois Perfis sem duplicar regras de apresentação.
5. Cobrir catálogo, otimista/rollback de estado e contratos SQL.
6. Aplicar no DEV via MCP, verificar persistência e grants, executar advisors.

## 7. Testes Obrigatórios

- Catálogo lista tipos corretos para STUDENT e PRO.
- Preferência ausente resulta em ligada.
- Alteração bem-sucedida persiste; erro restaura estado anterior.
- Contrato SQL contém auth.uid, lista canônica, RLS, grants e trigger de filtro.
- Lint, suíte completa e `build:all`.

## 8. O que NÃO Alterar

- Produtores de notificações existentes, títulos, destinos, push device registry e regras de Aula Agora.
- Notificações históricas.
- Fluxo de edição/salvamento dos dados cadastrais do Perfil.
- Production Supabase.

## 9. Instruções para o MAZZI Dev

Usar os componentes Button/Input existentes quando aplicável, manter switches com semântica nativa e alvo mínimo de toque, usar tokens MAZZI e mensagens inline. Não usar estado local como fonte definitiva: o estado local é apenas feedback otimista até a RPC confirmar.
