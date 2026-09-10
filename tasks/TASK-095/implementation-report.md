# TASK-095 — Relatórios em pt-BR com visão diária

TASK: TASK-095
STATUS: READY_FOR_QA
OWNER: MAZZI Dev
LAST_UPDATED: 2026-09-10

## O que foi Implementado

- Tradução de títulos, métricas, status, papéis, eventos e motivos dos relatórios para pt-BR, incluindo rótulos compostos como evento/status.
- Tabela de visão diária dentro de cada um dos dez relatórios, com colunas específicas por domínio e todos os dias do intervalo, inclusive dias zerados.
- Separação explícita entre cancelamentos após pagamento e desistências de pagamento.
- Cartões de totais para quantidade e valor dos dois desfechos no relatório de cancelamentos.
- Tabela com rolagem horizontal interna para preservar o layout em telas pequenas e no PDF.
- Pequeno ajuste de determinismo no teste de jornada existente, que dependia do relógio real e falhava após o horário fixo da aula.

## Arquivos Alterados

- `src/components/admin/AdminReportsPanel.tsx`
- `src/lib/db-service.ts`
- `src/types/index.ts`
- `tests/admin-reports-contract.test.ts`
- `src/__tests__/student-journey.test.ts`
- `supabase/migrations/20260910125357_admin_reports_daily_breakdown.sql`

## Migration Criada e Aplicada

- `20260910125357_admin_reports_daily_breakdown` aplicada no Supabase DEV `bhvpkgonhlujmxvwnxix`.
- Função criada: `public.get_admin_report_daily(timestamptz, timestamptz)`.
- Ledger remoto conferido após aplicação.

## Decisões Técnicas Tomadas

- O backend retorna a série diária agregada em centavos inteiros; a UI apenas formata BRL.
- Cancelamento pós-pagamento exige reserva cancelada e ao menos um pagamento `PAID`.
- Desistência exige tentativa `FAILED`, `CANCELLED` ou `EXPIRED` sem qualquer pagamento `PAID` para a reserva.
- A função usa timezone `America/Sao_Paulo`, valida Admin ativo e limita o período a 366 dias.
- A nova função revoga execução pública/anon e concede somente a `authenticated`.

## Desvios do Plano Técnico

Nenhum desvio funcional. A série diária é retornada uma vez pelo backend e projetada em cada card com colunas pertinentes, evitando duplicar agregações no banco.

## Testes Adicionados

- Contrato da migration, grants, timezone, campos de desfecho e presença das tabelas diárias na UI.
- Teste de jornada com relógio fake para manter a data futura determinística.

## Testes Executados

- `npm run lint`: aprovado.
- `npm test`: 160 arquivos e 1065 testes aprovados.
- `npm test -- --run tests/admin-reports-contract.test.ts`: 4 testes aprovados.
- Smoke Supabase Admin: retorno diário real validado.
- Smoke sem autenticação: `AUTH_REQUIRED`.
- Smoke acima de 366 dias: `REPORT_PERIOD_TOO_LARGE`.
- `npm run build:all`: student, instructor, admin e landing aprovados.

## Limitações e Riscos Conhecidos

- Desistência não é inferida para reservas sem tentativa de pagamento registrada.
- O advisor do Supabase continua exibindo achados preexistentes do projeto, incluindo `spatial_ref_sys` sem RLS; esta task não alterou esse objeto.

## Handoff para QA

Auditar a seleção de cada relatório, a renderização diária em viewport mobile, a tradução de valores compostos e as regras de separação financeira no DEV.
