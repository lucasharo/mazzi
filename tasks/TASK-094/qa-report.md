# TASK-094 — Auditoria QA

TASK: TASK-094  
STATUS: QA_APPROVED  
OWNER: MAZZI QA  
LAST_UPDATED: 2026-09-09

## Resultado

**APROVADO**, sem bugs BLOCKER, CRITICAL ou HIGH encontrados na implementação dos relatórios.

## Ambiente auditado

- Repositório local `D:\mazzi_premium_ui_v2`, branch `feature/premium-ui-v2`.
- Supabase DEV `bhvpkgonhlujmxvwnxix`.
- RPCs e ledger verificados após aplicação das migrations `20260910001206` e `20260910001920`.
- `npm run lint`, `npm test` e `npm run build:all` aprovados.

## Critérios de aceite

- **AC01 — PASS:** rota Admin “Relatórios” renderiza dez domínios e o contrato não inclui os campos sensíveis proibidos.
- **AC02 — PASS:** datas inicial/final e atalhos de 7, 30, 90 e 366 dias atualizam a RPC com limites no timezone operacional.
- **AC03 — PASS:** smoke tests confirmaram `AUTH_REQUIRED`, `FORBIDDEN` e `REPORT_PERIOD_TOO_LARGE` nos caminhos negativos.
- **AC04 — PASS:** loading, erro, estado sem dados e nenhuma seleção têm apresentação própria sem quebrar os demais cards.
- **AC05 — PASS:** cada relatório usa `aria-pressed`; a seleção controla cards visíveis e a impressão/PDF.
- **AC06 — PASS:** valores financeiros trafegam em centavos inteiros e a conversão para BRL ocorre apenas na apresentação.
- **AC07 — PASS:** `window.print()` usa escopo de impressão e esconde controles; o fluxo é compatível com “Salvar como PDF”.
- **AC08 — PASS:** controles têm mínimo de 44px; filtros quebram em telas pequenas e tabelas rolam dentro do próprio card.
- **AC09 — PASS:** labels de datas, `aria-pressed`, `role=alert`, `role=status`, foco visível e controles de teclado estão presentes.
- **AC10 — PASS:** alteração isolada na rota Admin, sem mudança em RLS/permissões de módulos vizinhos.

## Happy path

1. Admin autenticado acessa o menu “Relatórios”.
2. A tela carrega o período padrão de 30 dias pela RPC agregadora.
3. Datas ou atalhos alteram o período e “Atualizar relatórios” refaz a consulta.
4. O Admin alterna relatórios e “Baixar PDF” imprime somente os selecionados.

## Negative tests

- Sessão sem `auth.uid()`: rejeitada com `AUTH_REQUIRED`.
- Usuário aluno ativo: rejeitado com `FORBIDDEN`.
- Período de 367 dias: rejeitado com `REPORT_PERIOD_TOO_LARGE`.
- Data inicial posterior à final e período acima de 366 dias: bloqueados antes da consulta na UI.
- Nenhum relatório selecionado: exportação desabilitada e alerta apresentado.

## Segurança e RLS/RBAC

- RPC `SECURITY DEFINER` com `search_path = public, pg_temp`.
- Execução removida de `public`, `anon` e `authenticated` recebeu apenas o grant necessário; autorização interna limita a `PLATFORM_ADMIN` ativo.
- O PDF usa o JSON já autorizado e não faz upload, não usa `service_role` e não acessa tabelas diretamente no frontend.
- O contrato não expõe e-mail, CPF, telefone, storage path, documentos, conteúdo de chat ou segredos.

## Mobile e responsividade

Auditoria estática dos breakpoints e classes de layout para 375px, 390px e 430px: filtros e chips quebram, os cards ocupam a largura disponível e tabelas usam overflow local. Todos os botões/atalhos têm `min-h-11`.

## Acessibilidade

Inputs possuem labels visíveis, seletores têm `aria-pressed`, loading/erro usam live semantics e os botões reutilizam o Design System com foco visível e alvos de toque adequados.

## Regressão

- Suíte: 160 arquivos e 1064 testes aprovados.
- Build dos apps Student, Instructor, Admin e Landing aprovado.
- O teste legado do Checkout que apresentou flutuação em uma execução paralela foi reproduzido isoladamente com 20/20 aprovado; a execução final completa também fechou com 160/160.

## Bugs encontrados

Nenhum bug da feature encontrado.

## Riscos identificados

- A geração de arquivo depende da caixa de impressão do navegador, por decisão de escopo.
- Métricas de busca sem resultado podem ficar zeradas quando eventos históricos não trazem `result_count`/`provider_count`.
- O diagnóstico do Supabase DEV também sinalizou um risco preexistente fora desta task: `public.spatial_ref_sys` está sem RLS. Não foi alterado automaticamente, pois habilitar RLS sem políticas pode bloquear o uso da tabela; a correção deve ser decidida separadamente.

## Recomendação para o Tech Lead

Homologar a TASK-094. A entrega atende aos critérios, possui RPC administrativa validada no DEV, migrations registradas no ledger remoto e não apresenta falha funcional ou de segurança no escopo auditado.
