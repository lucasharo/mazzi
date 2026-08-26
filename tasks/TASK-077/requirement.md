# TASK-077 — PRO defaults, notificações contextuais e UX de veículo

TASK: TASK-077
STATUS: PRODUCT_READY
OWNER: MAZZI Product
LAST_UPDATED: 2026-08-26

## Objetivo

Entregar um bloco coeso para: disponibilidade inicial de novos profissionais, isolamento de notificações por aplicativo, feedback MAZZI para erros de veículo e garantia de CNPJ para Autoescolas/CFCs.

## Problema

Novos PROs não recebem uma configuração inicial explícita de agenda, identidades multi-role podem misturar notificações, falhas de veículo podem abrir alertas nativos e o contrato de documento empresarial precisa ser comprovadamente CNPJ-only.

## Usuário Afetado

STUDENT, INSTRUCTOR, SCHOOL_ADMIN e PLATFORM_ADMIN.

## Escopo

- DRIVING_SCHOOL exige CNPJ normalizado de 14 dígitos, com validação amigável e backend autoritativo.
- Novo INSTRUCTOR recebe uma única agenda recorrente MON–FRI, 08:00–18:00, America/Sao_Paulo; sem backfill ou recriação posterior.
- Notificações são consultadas, contadas e marcadas por contexto STUDENT, PRO ou ADMIN.
- Erros funcionais de ativação de veículo deixam de usar alertas nativos e usam feedback MAZZI.

## Fora de Escopo

- Gateway real, Production, nova infraestrutura de push, backfill de providers legados, alteração de lifecycle/compliance já aprovado e qualquer arquitetura paralela de agenda, staff, oferta ou veículo.

## Regras de Negócio

- A identidade Auth é humana; DRIVING_SCHOOL usa CNPJ, nunca CPF do responsável.
- Mesmo CNPJ do mesmo responsável é idempotente; de outra identidade é bloqueado sem revelar titularidade.
- Agenda default é criada somente durante o primeiro bootstrap elegível e jamais é restaurada após edição/exclusão.
- DRAFT não se torna publicamente agendável pelo default.
- Identidade multi-role mantém inbox, badge, mark-one e mark-all independentes por app_context.
- Falha de veículo preserva o status real e mostra mensagem amigável sem códigos técnicos.

## Fluxo Principal (Happy Path)

1. Pessoa escolhe Autoescola/CFC, informa CNPJ válido e endereço confirmado; a escola DRAFT é criada/reutilizada e ela recebe SCHOOL_ADMIN.
2. Novo instrutor recebe as cinco regras 08:00–18:00 no bootstrap inicial.
3. Aluno e PRO visualizam somente notificações do contexto do respectivo app.
4. Ao falhar a ativação de veículo, o PRO vê feedback MAZZI e pode tentar novamente.

## Casos de Borda e Exceções

- CPF de 11 dígitos, CNPJ inválido, retry/double-click, CNPJ já associado a outro usuário, alteração/exclusão da agenda e multi-role STUDENT+INSTRUCTOR/SCHOOL_ADMIN.
- Sem contexto legado: compatibilidade segura definida pela migração/API; jamais vazar entre apps.

## Estados de Erro e Mensagens Amigáveis

- CNPJ inválido: “Informe um CNPJ válido.”
- CNPJ existente de outra pessoa: “Este CNPJ já está cadastrado no MAZZI.”
- Veículo inelegível: “Este veículo ainda não atende a todos os requisitos necessários para ativação. Verifique os dados e documentos pendentes.”

## Critérios de Aceite

- **AC01**: Escola aceita apenas CNPJ válido, normalizado em 14 dígitos no backend e frontend.
- **AC02**: Retry não duplica escola; outro usuário não a assume; roles existentes permanecem.
- **AC03**: Novo instrutor recebe exatamente MON–FRI 08:00–18:00 America/Sao_Paulo, uma única vez.
- **AC04**: Edição/exclusão não recria disponibilidade; provider legado não recebe backfill.
- **AC05**: Student e PRO recebem, contam e marcam somente notificações do próprio contexto.
- **AC06**: Falha de ativação de veículo não chama alert/window.alert, não expõe erro bruto e preserva estado.
- **AC07**: Testes, lint, três builds, CI e baseline verify passam; DEV somente para migrations.

## Dependências

ProviderAddressForm, onboarding RPC, weekly_availability, notifications, feedback/toast existente, RLS/RBAC e Supabase DEV `bhvpkgonhlujmxvwnxix`.

## Decisões Pendentes

Nenhuma: o contrato de default para escola será definido pelo recurso schedulable real, sem IDs nulos/fake.

## Riscos de Produto

Contextualização de notificações deve preservar comportamento legado sem vazamento. Bootstrap de agenda não pode alterar providers existentes.

## Handoff para Tech Lead

Auditar contratos existentes e usar somente extensões forward-only, reutilizando engine e feedback canônicos.
