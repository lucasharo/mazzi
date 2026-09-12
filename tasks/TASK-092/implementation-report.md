# Implementation Report — TASK-092

TASK: TASK-092
STATUS: READY_FOR_QA
OWNER: MAZZI Dev
LAST_UPDATED: 2026-09-05

## 1. O que foi Implementado

- Catálogo único dos 16 tipos de notificação existentes no contrato da aplicação.
- Link reutilizável no Perfil do Aluno e no Perfil do PRO para a central de notificações.
- Seção reutilizável de preferências dentro da central de notificações, mantendo a configuração fora do card do perfil.
- Switch nativo e acessível por evento, com descrição, estado explícito, loading e rollback em caso de erro.
- Aluno visualiza 9 tipos compatíveis com seu contexto; PRO visualiza 13 tipos compatíveis com seu contexto.
- Tipos ainda sem registro aparecem habilitados para preservar o comportamento atual.
- Alterações são persistidas imediatamente por RPC autenticada.
- Backend filtra novas notificações explicitamente desabilitadas; histórico não é removido.

## 2. Arquivos Criados ou Alterados

- `src/lib/notification-preferences.ts`
- `src/components/notifications/NotificationPreferences.tsx`
- `src/lib/db-service.ts`
- `src/types/index.ts`
- `src/apps/student/StudentApp.tsx`
- `src/apps/provider/components/ProviderProfileTab.tsx`
- `src/components/notifications/NotificationCenterLink.tsx`
- `src/components/notifications/NotificationsPanel.tsx`
- `tests/notification-preferences.test.ts`
- `supabase/migrations/20260906005838_task_092_notification_preferences.sql`
- `supabase/migrations/20260906010016_task_092_notification_preferences_policy_hardening.sql`
- `docs/CURRENT_IMPLEMENTATION_STATUS.md`

## 3. Migrations Criadas e Aplicadas

- Supabase DEV `bhvpkgonhlujmxvwnxix`: `task_092_notification_preferences` e `task_092_notification_preferences_policy_hardening` aplicadas com sucesso via MCP.
- Verificado: RLS ativo, política explícita de negação direta, grants somente das RPCs para `authenticated`, trigger `BEFORE INSERT` instalado.
- Production não foi acessada nem alterada.

## 4. Decisões Técnicas Tomadas

- A preferência é por tipo de evento, não por canal, nesta entrega.
- A tabela não recebe grants diretos do cliente; leitura e escrita passam por RPCs que usam `auth.uid()`.
- Um trigger centralizado evita que cada produtor de notificação precise duplicar a regra de preferência.
- `PROVIDER_ON_THE_WAY` foi incluído no contrato TypeScript porque já existe no contrato SQL atual.

## 5. Desvios do Technical Plan

Nenhum desvio funcional. A proteção de política foi separada em uma segunda migration forward-only para manter o DEV já aplicado consistente com o histórico local.

## 6. Testes Automatizados Adicionados

- Catálogo por contexto Student/PRO e contagem dos 16 tipos.
- Contrato de persistência no `dbService` e rollback otimista.
- Contrato SQL de RLS, autenticação, validação canônica, grants e filtro sem exclusão histórica.

## 7. Resultados dos Portões de Qualidade

- **Lint**: `npm run lint` aprovado (`tsc --noEmit`).
- **Testes**: `npm test -- --pool=threads --maxWorkers=1 --fileParallelism=false` — 146 arquivos, 955 testes aprovados.
- **Build Student**: aprovado.
- **Build Instructor**: aprovado.
- **Build Admin**: aprovado.
- **Build Landing**: aprovado.
- **Diff check**: aprovado.

## 8. Testes Manuais Realizados

- Student DEV em `http://127.0.0.1:3001/`, login rápido, Perfil e viewports 375px, 390px e 430px.
- Provider DEV em `http://127.0.0.1:3002/`, login rápido, Perfil e viewports 375px, 390px e 430px.
- Student: switch de “Aulas confirmadas” desligado e religado; estado visual atualizado e registro final `enabled = true` confirmado no DEV para `aluno01@mazzi.com.br`.
- Snapshot confirmou labels acessíveis, contextos corretos e ausência de opções de payout no Student.
- Em 390px e 430px, os dois Perfis mantiveram a seção presente e sem overflow horizontal.

## 9. Limitações e Riscos Conhecidos

- A preferência bloqueia novas inserções; notificações já gravadas continuam visíveis, conforme requisito.
- Advisors do projeto continuam apresentando avisos históricos gerais; nenhum aviso relacionado à nova tabela permaneceu após a aplicação da política explícita.
- A configuração de canais de push/e-mail separados permanece fora do escopo.

## 10. Handoff para QA

Auditar a persistência com duas identidades autenticadas, a rejeição de tipo inválido/anon, o filtro de uma nova notificação com preferência desligada e a responsividade da lista em 375px, 390px e 430px.
