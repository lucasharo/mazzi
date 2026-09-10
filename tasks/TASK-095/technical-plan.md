# TASK-095 — Plano técnico

TASK: TASK-095
STATUS: TECH_READY
OWNER: MAZZI Tech Lead
LAST_UPDATED: 2026-09-10

## 1. Resumo Técnico

Adicionar a RPC `public.get_admin_report_daily(timestamptz, timestamptz)` em migration forward-only. A função retorna linhas diárias completas no timezone `America/Sao_Paulo` e um bloco `payment_outcomes`. O frontend fará uma segunda chamada paralela à RPC existente e renderizará a nova seção no `AdminReportsPanel`.

## 2. Código Existente Relacionado

- `src/components/admin/AdminReportsPanel.tsx`
- `src/lib/db-service.ts`
- `src/types/index.ts`
- `supabase/migrations/20260910001920_fix_admin_reports_payment_alias.sql`
- `tests/admin-reports-contract.test.ts`

## 3. Arquivos Afetados

- `[NEW]` `supabase/migrations/<timestamp>_admin_reports_daily_breakdown.sql`
- `[NEW]` `tasks/TASK-095/*`
- `[MODIFY]` `src/types/index.ts`
- `[MODIFY]` `src/lib/db-service.ts`
- `[MODIFY]` `src/components/admin/AdminReportsPanel.tsx`
- `[MODIFY]` `tests/admin-reports-contract.test.ts`

## 4. Banco de Dados & Migrations

Não criar tabelas nem alterar dados. A RPC usará agregações server-side sobre tabelas existentes, `SECURITY DEFINER`, `search_path` fixo, validação do usuário ativo/admin, limite de 366 dias e grants somente para `authenticated`. O código da migration será aplicado no Supabase DEV e o ledger remoto será conferido antes do merge.

## 5. RLS e RBAC Afetados

Nenhuma policy será alterada. A função repetirá `auth.uid()`, `is_current_user_active()` e `is_platform_admin()`, mantendo o relatório inacessível para anon, usuários comuns e suporte.

## 6. Estratégia de Implementação

1. Criar contrato de tipos para a série diária, colunas por domínio e desfechos financeiros.
2. Criar a RPC com uma série de datas, agregações por dia e regras anti-duplicação.
3. Aplicar e validar a migration no DEV.
4. Adicionar método no `db-service` e carregar os dois contratos em paralelo.
5. Traduzir labels/status/eventos/motivos com mapa determinístico e fallback `Não informado`.
6. Renderizar uma tabela responsiva dentro de cada um dos dez cards e cartões separados de cancelamento pós-pagamento/desistência.
7. Atualizar teste de contrato e executar lint, testes e builds.

## 7. Testes Obrigatórios

- Contrato da migration e grants.
- Presença dos campos diários e das duas métricas separadas.
- Smoke autenticado no DEV com Admin.
- Smoke negativo anon, aluno e intervalo acima de 366 dias.
- Lint, suíte completa e `build:all`.
- Revisão mobile em 375px/390px/430px, incluindo overflow interno da tabela e targets de 44px.

## 8. O que NÃO Alterar

- RPC `get_admin_reports` já aplicada.
- Estados de bookings/payments, políticas de cancelamento e checkout.
- RLS, dados, credenciais e produção.
- Os dez identificadores públicos dos relatórios.

## 9. Instruções para o MAZZI Dev

Usar centavos inteiros, não incluir PII no JSON, preservar o timezone operacional, traduzir apenas na apresentação e não mascarar ausência de dados como erro técnico. Aplicar a migration oficial no DEV e registrar o ledger e os smoke tests nos artefatos da TASK.
