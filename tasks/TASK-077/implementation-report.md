# Implementation Report — TASK-077

TASK: TASK-077
STATUS: READY_FOR_QA
OWNER: MAZZI Dev
LAST_UPDATED: 2026-08-26

## 1. O que foi Implementado

- Validação local de checksum CNPJ e mensagens de erro específicas, mantendo a RPC de onboarding como autoridade final.
- Agenda padrão de instrutor novo: segunda a sexta, 08:00–18:00, America/Sao_Paulo, criada somente junto do novo provider e nunca restaurada em retry/edição.
- Contexto explícito de notificações (`STUDENT`, `PRO`, `ADMIN`) na base, no serviço, no contador e no painel, incluindo marcar uma ou todas como lidas no contexto atual.
- Feedback de erro no fluxo funcional de veículo/oferta passou a usar os estados já renderizados pela Gestão PRO, substituindo alertas nativos.

## 2. Arquivos Criados ou Alterados

- `supabase/migrations/20260826050000_task_077_pro_defaults_and_notification_context.sql`
- `src/lib/input-masks.ts`
- `src/components/auth/AppLogin.tsx`
- `src/lib/db-service.ts`
- `src/components/notifications/NotificationsPanel.tsx`
- `src/components/ui/NotificationIndicator.tsx`
- `src/components/ui/AppHomeHeader.tsx`
- `src/apps/student/StudentApp.tsx`
- `src/apps/provider/ProviderApp.tsx`
- `src/apps/provider/components/ProviderHeader.tsx`
- `src/apps/admin/AdminApp.tsx`
- `src/types/index.ts`
- `tests/task-077-pro-defaults-context.test.ts`

## 3. Migrations Criadas e Aplicadas

`20260826050000_task_077_pro_defaults_and_notification_context.sql` foi aplicada exclusivamente ao Supabase DEV `bhvpkgonhlujmxvwnxix` e registrada no ledger. Production não foi consultado nem alterado.

## 4. Decisões Técnicas Tomadas

- A escola não recebe horários default: no onboarding ela não possui ainda instrutor/veículo agendável.
- O banco deriva o contexto das notificações de booking/conversation/review; o cliente apenas solicita seu contexto de apresentação.
- A migration é forward-only e preserva RLS existente.

## 5. Desvios do Technical Plan

Nenhum. A busca executável da skill UI não foi usada porque o script fornecido possui erro de sintaxe; as diretrizes lidas da skill foram aplicadas diretamente.

## 6. Testes Automatizados Adicionados

- CNPJ válido/inválido e mensagens CNPJ.
- Bootstrap de disponibilidade de instrutor novo, sem finais de semana.
- Contexto de notificações por PWA, contagem e leitura em massa.
- Regressão de feedback de veículo/oferta sem alerta nativo.

## 7. Resultados dos Portões de Qualidade

- Lint: PASS
- Testes: 769 passed, 0 failed
- Build Student: PASS
- Build Instructor: PASS
- Build Admin: PASS
- `git diff --check`: PASS

## 8. Testes Manuais Realizados

- Revisão estática dos painéis e dos estados de erro já renderizados na Gestão PRO.
- Revisão do contrato de contexto nas três aberturas de notificações.

## 9. Limitações e Riscos Conhecidos

- Os builds sinalizam apenas os avisos preexistentes de chunk maior que 500 kB; não bloqueiam a compilação.

## 10. Handoff para QA

- Validar CNPJ inválido e duplicado no onboarding da autoescola.
- Criar um novo instrutor e confirmar cinco regras padrão sem sábado/domingo.
- Em uma conta multi-role, confirmar que Student e PRO mostram painéis e contadores diferentes.
- Tentar reativar veículo/oferta sem elegibilidade e confirmar erro in-screen.
