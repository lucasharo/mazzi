# TASK-006 — Relatório de Auditoria QA: Idempotência Atômica no Create Quote

**TASK**: TASK-006  
**STATUS**: QA_APPROVED  
**OWNER**: MAZZI QA  
**LAST_UPDATED**: 2026-08-18

---

## Resultado

**APROVADO**

---

## Ambiente Auditado

- Banco de dados PostgreSQL / Supabase remoto
- Aplicação React / Vite local (rodando em modo student na porta 3001)
- Suíte de testes automatizados via Vitest

---

## Critérios de Aceite

- **AC01 — Chamada Única**: **PASS** (Criação de cotação normal retornando `is_idempotent = false` e persistindo 1 linha).
- **AC02 — Retry Sequencial**: **PASS** (Segunda chamada com mesmos parâmetros retorna `is_idempotent = true`, mesmo `quote_id` e sem duplicar dados).
- **AC03 — Concorrência Real**: **PASS** (Execução paralela de 10 chamadas via `Promise.all` não gera conflito 23505/409, todas retornam o mesmo ID e apenas 1 linha é inserida).
- **AC04 — Key Reuse Inválido (Offering)**: **PASS** (Tentativa de reutilizar chave com oferta diferente falha com erro `QUOTE_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST`).
- **AC05 — Key Reuse Inválido (Slot)**: **PASS** (Tentativa de reutilizar chave com horário diferente falha com o mesmo erro).
- **AC06 — Double Click Frontend**: **PASS** (Guard `isProcessing` e `createQuoteInFlightRef` bloqueiam cliques concorrentes no botão e chamadas duplicadas no modal).
- **AC07 — E2E Booking Sem Erros**: **PASS** (Fluxo finalizado com sucesso sem apresentar erros vermelhos de conflito/409).
- **AC08 — Sem Regressões**: **PASS** (Validadas políticas existentes de cancelamento, RLS de CPF/birth_date e pagamentos mockados).

---

## Happy Path

1. Estudante seleciona aula e abre o CheckoutModal.
2. Cotação é gerada no banco remoto na primeira tentativa (`is_idempotent = false`).
3. Ao clicar em "Confirmar aula", o botão entra em loading state, bloqueia novos cliques, cria o holding slot e avança para a tela de pagamento PIX sem gerar chamadas duplicadas.

---

## Negative Tests

- Enviada cotação com chave de idempotência já utilizada com um `offering_id` diferente. A RPC capturou a tentativa de fraude/reuso e abortou imediatamente com exceção controlada no PostgreSQL.
- Enviada cotação com chave utilizada para data diferente. Rejeitado conforme esperado.

---

## Segurança e RLS/RBAC

- O RPC `create_quote_from_offering` mantém `SECURITY DEFINER` e restringe a execução exclusivamente a usuários autenticados via `GRANT EXECUTE TO authenticated` e `REVOKE ALL FROM PUBLIC, anon`.
- As políticas de RLS e o isolamento de dados do `student_id` no insert de cotações foram validados e preservados.

---

## Mobile e Responsividade

- O botão "Confirmar aula" foi validado em viewport mobile (375px) com área de clique maior que 44px e responsividade preservada no design system do checkout.

---

## Acessibilidade (a11y)

- Elementos de loading e botões mantêm os atributos `aria-label`, `aria-hidden` e contraste de cor premium do MAZZI.

---

## Regressão

- Rodada a suíte completa de testes de regressão do projeto (`51 arquivos de teste / 435 specs`). Todas as specs de cancelamento (DEC-013), validações de idade e CPF passaram sem erros.

---

## Bugs Encontrados

Nenhum bug blocker, critical ou high identificado.

---

## Riscos Identificados

- Risco de expiração de cotações concorrentes: Mitigado pela lógica de timeout preexistente (10 minutos) que permanece ativa.

---

## Recomendação para o Tech Lead

Recomenda-se a aprovação final e transição da tarefa para o estado `DONE`.
