# TASK-091 — QA da Consolidação da Aula Agora PRO

TASK: TASK-091
STATUS: QA_APPROVED
OWNER: MAZZI QA
LAST_UPDATED: 2026-09-04

## Resultado

APROVADO COM RESSALVAS OPERACIONAIS. Não foram encontrados bugs BLOCKER,
CRITICAL ou HIGH no diff, nos testes locais ou nos contratos live do DEV.

## Ambiente Auditado

- Repositório `D:\mazzi_premium_ui_v2`.
- Supabase DEV `bhvpkgonhlujmxvwnxix`.
- Navegador local em `http://localhost:3002/`, viewport padrão do agente.
- Production não auditada nem alterada.

## Critérios de Aceite

- AC01 — PASS: mapper e tipos não transformam status em `ON_THE_WAY`.
- AC02 — PASS: timestamp persistido deriva estado operacional e mantém `CONFIRMED`.
- AC03 — PASS: RPC live exige instrutor atribuído e status `CONFIRMED`.
- AC04 — PASS: lock, timestamp persistido e guarda de retry impedem duplicação.
- AC05 — PASS: fallback de browser, storage e update direto foram removidos.
- AC06 — PASS: leitura PRO redige ponto/snapshot no pagamento pendente e libera
  coordenadas estruturadas após confirmação.
- AC07 — PASS: DEV possui funções corrigidas, grants restritivos, matching
  distinto, onda 3 e janela fail-closed.
- AC08 — PASS: build e jornada de aulas PRO carregaram sem regressão observada.
- AC09 — PASS: testes adversariais de mapper, estado, check-in, SQL e contratos.
- AC10 — PASS: lint, testes, quatro builds e diff check aprovados.

## Happy Path

O portal PRO carregou após login DEV; a rota de aulas exibiu booking e estados
canônicos. A leitura live das funções confirmou o contrato de pagamento,
matching, deslocamento e redaction.

## Negative Tests

Foram cobertos localmente status inválido, reserva terminal, sessão operacional
sem horário, localização inválida, coordenadas ausentes, retry e payload de
booking com ponto estruturado. O contrato live bloqueia `anon` nas funções críticas.

## Segurança e RLS/RBAC

As funções críticas estão `SECURITY DEFINER`, com `search_path` fixo, execução
para `authenticated` e bloqueio para `anon`. `set_provider_on_the_way` valida
`auth.uid() = instructor_id`; owner e staff não podem declarar deslocamento em
nome do instrutor. A redaction remove também chaves de coordenadas do snapshot.

## Mobile e Responsividade

Nenhuma alteração visual estrutural foi introduzida nesta consolidação. O
build preservou os componentes existentes e a alteração prévia do seletor.

## Acessibilidade (a11y)

Nenhum novo controle visual foi criado; os componentes existentes permanecem
responsáveis por foco, rótulos e alvos de toque.

## Regressão

142 arquivos de teste e 928 testes aprovados; quatro builds aprovados. A tela
PRO de aulas foi aberta no navegador sem erro de inicialização.

## Bugs Encontrados

Nenhum BUG pendente.

## Riscos Identificados

Os advisors do projeto reportam avisos históricos gerais de RLS/policies e
índices, não introduzidos por esta task. Não houve execução de mutações live
com duas identidades para simular concorrência, pois isso alteraria dados DEV.

## Recomendação para o Tech Lead

Aprovar a consolidação para o ambiente DEV e manter Production bloqueada até
um smoke autenticado controlado com contas de teste dedicadas.
