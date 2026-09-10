# TASK-094 — Relatórios administrativos

TASK: TASK-094  
STATUS: READY_FOR_QA  
OWNER: MAZZI Dev  
LAST_UPDATED: 2026-09-09

## O que foi implementado

- Nova área **Relatórios** no painel Admin.
- Dez relatórios agregados: resumo executivo, reservas, receita/pagamentos, repasses, oferta, demanda/liquidez, usuários, compliance, cancelamentos/contestações e comunicações.
- Filtros de data inicial e final com atalhos de 7, 30, 90 e 366 dias.
- Seleção individual dos relatórios visíveis, refletida também no PDF.
- Exportação pelo fluxo nativo de impressão do navegador, com CSS de impressão que remove navegação, filtros e botões para usar “Salvar como PDF”.
- Estados de carregamento, erro, ausência de dados, período inválido e nenhum relatório selecionado.

## Arquivos alterados

- `[NEW]` `src/components/admin/AdminReportsPanel.tsx`
- `[MODIFY]` `src/apps/admin/AdminApp.tsx`
- `[MODIFY]` `src/lib/db-service.ts`
- `[MODIFY]` `src/types/index.ts`
- `[NEW]` `tests/admin-reports-contract.test.ts`
- `[NEW]` `tasks/TASK-094/requirement.md`
- `[NEW]` `tasks/TASK-094/technical-plan.md`

## Migrations criadas e aplicadas

- `supabase/migrations/20260910001206_admin_reports.sql`
- `supabase/migrations/20260910001920_fix_admin_reports_payment_alias.sql`

As duas migrations foram aplicadas no Supabase DEV `bhvpkgonhlujmxvwnxix` e conferidas no ledger remoto. A segunda é uma correção forward-only encontrada no smoke test autenticado do primeiro agregado de pagamentos; nenhuma migration aplicada foi alterada ou revertida.

## Decisões técnicas tomadas

- O frontend chama exclusivamente `public.get_admin_reports`; não há SELECT direto das tabelas protegidas.
- A RPC é `SECURITY DEFINER`, fixa `search_path`, exige usuário ativo e `PLATFORM_ADMIN`, limita o intervalo a 366 dias e concede execução somente a `authenticated`.
- Valores financeiros permanecem em centavos inteiros no contrato e só são formatados na UI.
- O PDF não é salvo no servidor nem enviado para Storage; o navegador controla a etapa final de salvar/imprimir.
- O contrato não retorna e-mail, CPF, telefone, conteúdo de mensagens, Storage path, documentos ou segredos.

## Desvios do plano técnico

- O conector do Supabase atribuiu timestamps próprios no ledger remoto (`20260910001206` e `20260910001920`); os nomes dos arquivos locais foram alinhados a eles para manter o histórico reconciliável.
- O relatório utiliza os eventos de demanda já existentes; quando um evento não traz contador de resultados, a métrica de busca sem resultado permanece zero em vez de inferir disponibilidade.

## Testes adicionados

- `tests/admin-reports-contract.test.ts`: proteção da RPC, limite de período, ausência de campos sensíveis, dez relatórios, filtros, seleção e impressão PDF.

## Testes executados

- `npm test`: **160 arquivos / 1064 testes aprovados**.
- Teste específico de relatórios: **1 arquivo / 3 testes aprovados**.
- Smoke autenticado no Supabase DEV: retorno dos 10 nós (`bookings`, `cancellations`, `communications`, `compliance`, `demand`, `executive`, `payouts`, `revenue`, `supply`, `users`).
- Negative smoke sem sessão: `AUTH_REQUIRED`.
- Negative smoke com usuário aluno: `FORBIDDEN`.
- Negative smoke com período de 367 dias: `REPORT_PERIOD_TOO_LARGE`.

## Resultado do lint

`npm run lint` (`tsc --noEmit`): aprovado, 0 erros.

## Resultado dos builds

- `npm run build:student`: aprovado.
- `npm run build:instructor`: aprovado.
- `npm run build:admin`: aprovado.
- `npm run build:landing`: aprovado.
- `npm run build:all`: aprovado.

## Testes manuais realizados

- Verificação do registro da RPC e permissão `EXECUTE` no banco DEV.
- Verificação autenticada da geração do JSON completo e da rejeição de acesso anônimo, aluno e período acima do limite.
- Revisão estática do layout responsivo: controles e seletores usam targets mínimos de 44px; tabelas têm rolagem própria e os filtros usam quebra de linha.

## Limitações e riscos conhecidos

- “Baixar PDF” abre a caixa de impressão do navegador; o nome do arquivo e o destino final dependem do navegador/OS.
- Algumas métricas dependem da presença histórica de eventos e status; ausência de dados é exibida sem inferência.
- O relatório executivo reutiliza o resumo analítico canônico já existente, mantendo a regra de negócio centralizada.

## Handoff para QA

Auditar AC01–AC10, especialmente autorização do RPC, ausência de PII, comportamento sem dados, seleção de relatórios na impressão e uso em 375px/390px/430px.
