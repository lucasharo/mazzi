# TASK-095 — Relatório QA

TASK: TASK-095
STATUS: QA_APPROVED
OWNER: MAZZI QA
LAST_UPDATED: 2026-09-10

## Resultado

APROVADO

## Ambiente Auditado

- Código local em `feature/premium-ui-v2`.
- Supabase DEV `bhvpkgonhlujmxvwnxix`.
- RPC `get_admin_report_daily` aplicada e executada com Admin ativo.

## Critérios de Aceite

- AC01 — PASS: labels, status, papéis, eventos e motivos conhecidos são traduzidos para pt-BR.
- AC02 — PASS: cada card selecionado contém tabela diária com dias zerados preservados.
- AC03 — PASS: colunas são específicas para executivo, reservas, receita, repasses, oferta, demanda, usuários, compliance, cancelamentos e comunicações.
- AC04 — PASS: cancelamento pós-pagamento e desistência têm contagens e valores separados.
- AC05 — PASS: RPC valida autenticação/Admin, limite de 366 dias e não retorna PII.
- AC06 — PASS: seleção e impressão/PDF permanecem no mesmo fluxo.
- AC07 — PASS: valores monetários permanecem em centavos no contrato.
- AC08 — PASS: tabelas usam rolagem horizontal interna e não expandem a página.

## Negative Tests

- Sem claim de usuário: `AUTH_REQUIRED`.
- Período de 367 dias: `REPORT_PERIOD_TOO_LARGE`.
- Período de três dias com dados reais: retornou quatro datas de calendário pela janela operacional e `payment_outcomes` consistente.

## Segurança e RLS/RBAC

- Nenhuma policy foi alterada.
- Execução da função revogada para `public` e `anon`, concedida somente para `authenticated`.
- A função exige usuário ativo e `is_platform_admin()`.
- Advisors foram consultados; os alertas observados são preexistentes e não foram ampliados pela migration.

## Mobile e Acessibilidade

- Tabela contida em `overflow-x-auto`, mantendo o viewport sem overflow global.
- Seletores existentes preservam `aria-pressed` e ações com componentes do Design System.
- Cabeçalhos de tabela identificam dia e métricas.

## Regressão

- Lint, suíte completa e builds dos quatro apps aprovados.
- Nenhum contrato dos dez identificadores de relatório foi alterado.

## Bugs Encontrados

Nenhum BLOCKER, CRITICAL ou HIGH.

## Recomendação para o Tech Lead

Homologar e publicar no DEV após o CI validar o commit.
