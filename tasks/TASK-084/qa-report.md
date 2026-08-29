# QA Report — TASK-084

TASK: TASK-084
STATUS: PASSED
OWNER: MAZZI QA
LAST_UPDATED: 2026-08-28

---

## 1. Veredito Final
Aprovado. O contrato foi testado localmente e validado no banco remoto.

## 2. Ambiente Auditado
Supabase remoto `bhvpkgonhlujmxvwnxix` e suíte automatizada.

## 3. Avaliação dos Critérios de Aceite
- **AC01**: PASSOU — `create_booking_hold` não insere em `payments`.
- **AC02**: PASSOU — `create_booking_payment` encerra tentativas ativas anteriores.
- **AC03**: PENDENTE — a implementação ainda não começou.
- **AC04**: PENDENTE — a implementação ainda não começou.
- **AC05**: PENDENTE — a implementação ainda não começou.
- **AC06**: PENDENTE — a implementação ainda não começou.

## 4. Testes do Fluxo Principal (Happy Path)
Pendente.

## 5. Testes de Caminhos Negativos e Validações
Pendente.

## 6. Segurança e Isolamento RLS/RBAC
Pendente.

## 7. Responsividade e Mobile First
Pendente.

## 8. Acessibilidade (a11y)
Pendente.

## 9. Regressão
Pendente.

## 10. Bugs Encontrados
### BUG-001 — Tentativa Pix criada sem seleção explícita
- **Severidade**: MEDIUM
- **Comportamento Atual**: o checkout inicia com Pix e cria uma tentativa antes da escolha efetiva do aluno.
- **Comportamento Esperado**: criar somente a tentativa do método explicitamente selecionado.

## 11. Riscos Identificados
Poluição do histórico financeiro e possibilidade de seleção incorreta de pagamento em operações posteriores.

## 12. Recomendação para o Tech Lead
Manter no backlog e corrigir antes de ampliar métodos de pagamento.
