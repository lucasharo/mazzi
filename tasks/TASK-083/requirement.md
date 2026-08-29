# TASK-083 — Identificação do pagamento com cartão de crédito

TASK: TASK-083
STATUS: IMPLEMENTED
OWNER: MAZZI Product
LAST_UPDATED: 2026-08-28

---

## 1. Objetivo
Alterar o texto da opção de pagamento **Cartão** para **Cartão de Crédito**.

## 2. Problema
A opção atual pode gerar a expectativa de que cartões de débito também são aceitos, embora o MAZZI ainda não ofereça esse meio de pagamento.

## 3. Usuário Afetado
Aluno.

## 4. Escopo
- Alterar o rótulo exibido no checkout para **Cartão de Crédito**.
- Manter Pix como opção separada.
- Preservar o fluxo atual de pagamento com cartão de crédito.

## 5. Fora de Escopo
- Habilitar cartão de débito.
- Alterar a integração ou o backend de pagamentos.
- Alterar os valores cobrados ou as regras de estorno.

## 6. Regras de Negócio
- **RN01**: O MAZZI deve deixar explícito que a opção disponível é cartão de crédito.
- **RN02**: Cartão de débito permanece bloqueado até nova decisão de produto e implementação específica.

## 7. Fluxo Principal (Happy Path)
1. O aluno abre o checkout.
2. Visualiza as opções Pix e **Cartão de Crédito**.
3. Seleciona cartão de crédito e segue pelo fluxo já existente.

## 8. Casos de Borda e Exceções
- Em ambiente de teste e produção, o rótulo deve ser o mesmo.
- Nenhuma opção de débito deve aparecer.

## 9. Estados de Erro e Mensagens
N/A.

## 10. Critérios de Aceite
- **AC01**: O checkout exibe **Cartão de Crédito** em vez de **Cartão**.
- **AC02**: O checkout exibe somente Pix e Cartão de Crédito.
- **AC03**: O fluxo existente de cartão de crédito continua funcionando.
- **AC04**: Nenhum texto promete ou sugere suporte a cartão de débito.

## 11. Dependências
Componente de checkout do aluno e textos de pagamento.

## 12. Decisões Pendentes
O suporte a débito permanece bloqueado até definição específica de produto e técnica.

## 13. Riscos de Produto
Baixo. A alteração reduz ambiguidade no meio de pagamento disponível.

## 14. Handoff para Tech Lead
Alterar somente os rótulos visíveis e validar todos os ambientes sem modificar o contrato de pagamento.
