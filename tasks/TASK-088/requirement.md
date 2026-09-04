# TASK-088 — Auditoria de performance e requisições duplicadas

Status: PRODUCT_READY  
Área: Student e profissional  
Prioridade: Alta, pré-lançamento  
Ambiente: DEV/local  

## Objetivo

Identificar, com evidência estática e medida, requisições duplicadas, refetches desnecessários, remounts excessivos e problemas de lifecycle nos apps Student e profissional. A primeira execução entrega somente auditoria e plano de implementação seguro.

## Problema

Trocas de aba, abertura de modais, retorno a uma tela, listeners de foco/visibilidade e subscriptions podem buscar os mesmos dados novamente. StrictMode em DEV também pode duplicar efeitos e precisa ser separado dos casos que permanecem em produção.

## Escopo

- mapear fetching, RPCs, selects, chamadas externas, contexts, hooks e subscriptions;
- medir os fluxos Student, profissional, booking, notificações e chat;
- classificar achados em P0–P3;
- apontar arquivo, causa, impacto e correção sugerida;
- produzir plano em fases com testes de não regressão.

## Fora de escopo nesta fase

- refatoração ampla ou troca de roteador;
- adoção automática de React Query/TanStack Query/SWR;
- alteração de schema, RLS, migrations ou Production;
- deploy, commit ou push da auditoria;
- remoção de Realtime sem evidência.

## Critérios de aceite

- [ ] Baseline de branch, HEAD, status, testes, build e StrictMode registrado.
- [ ] Student e profissional auditados por tela e por request relevante.
- [ ] Duplicações apenas de DEV separadas das duplicações de produção.
- [ ] Supabase, Realtime, navegação/remount e mutations cobertos.
- [ ] Fluxos obrigatórios medidos, incluindo primeira carga e retorno.
- [ ] Top 10, quick wins, refactors maiores, fases e impacto estimado registrados.
- [ ] Próximo status definido como `READY_FOR_PERFORMANCE_OPTIMIZATION`.

## Regras

- Backend permanece a fonte da verdade.
- Não usar float para dinheiro e não alterar regras financeiras nesta task.
- Não alterar Production: `PRODUCTION_UNTOUCHED`.
