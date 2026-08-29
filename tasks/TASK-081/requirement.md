# TASK-081 — Tela de sucesso do Pix

TASK: TASK-081
STATUS: IMPLEMENTED
OWNER: MAZZI Product
LAST_UPDATED: 2026-08-28

---

## 1. Objetivo
Exibir no Pix a mesma experiência visual de sucesso já utilizada no pagamento com cartão: uma sobreposição verde animada, seguida pelo modal branco de aula confirmada.

## 2. Problema
Após o pagamento do Pix, o aluno pode permanecer na tela de pagamento sem perceber claramente que a reserva foi confirmada. No teste realizado, o botão **Atualizar status** confirmou o pagamento e exibiu a tela verde corretamente, mas o refresh automático não concluiu a confirmação.

## 3. Usuário Afetado
Aluno.

## 4. Escopo
- Reutilizar a animação de sucesso existente no fluxo de cartão.
- Disparar a animação somente após o backend confirmar o pagamento Pix e a reserva.
- Corrigir o refresh automático para detectar o pagamento aprovado sem depender do clique manual em **Atualizar status**.
- Manter a tela final de confirmação com fundo branco.

## 5. Fora de Escopo
- Aprovar pagamento no frontend sem confirmação do backend.
- Alterar regras de cobrança, webhook, estorno ou conciliação.
- Manter o modal final permanentemente com fundo verde.

## 6. Regras de Negócio
- **RN01**: A animação só pode iniciar quando o pagamento estiver `PAID` e a reserva `CONFIRMED`.
- **RN02**: Gerar o QR Code ou detectar o pagamento localmente não confirma a reserva.
- **RN03**: A animação verde deve ser temporária e depois abrir a confirmação branca da aula.

## 7. Fluxo Principal (Happy Path)
1. O aluno gera o QR Code Pix.
2. O Mercado Pago confirma o pagamento via consulta ou webhook.
3. O backend confirma o pagamento e a reserva.
4. O app exibe a tela verde animada por aproximadamente 1 segundo.
5. O app apresenta o modal branco de aula confirmada.

## 8. Casos de Borda e Exceções
- O pagamento continua pendente: permanecer na tela Pix e permitir atualizar o status.
- O pagamento é recusado ou expirado: exibir o estado de erro correspondente.
- O webhook chega depois da consulta manual: manter o fluxo idempotente.

## 9. Estados de Erro e Mensagens
- Pagamento pendente: "Aguardando confirmação do Pix."
- Pagamento confirmado: iniciar a animação de sucesso.
- Falha na confirmação: "Não foi possível confirmar o pagamento Pix. Tente atualizar o status."

## 10. Critérios de Aceite
- **AC01**: Um Pix confirmado exibe a mesma animação de sucesso do cartão.
- **AC02**: A animação não aparece para Pix pendente, recusado ou expirado.
- **AC03**: Após a animação, o modal de aula confirmada permanece com fundo branco.
- **AC04**: O fluxo funciona tanto após polling/atualização manual quanto após webhook.
- **AC05**: Após o pagamento aprovado, o polling automático atualiza o status sem exigir interação do aluno.

## 11. Dependências
`CheckoutModal`, `MercadoPagoPixCheckout`, confirmação de pagamento Pix, webhook e status da reserva.

## 12. Decisões Pendentes
Definir a duração final da sobreposição verde e validar o comportamento em dispositivos móveis.

## 13. Riscos de Produto
Uma transição acionada antes da confirmação do backend pode comunicar uma reserva inexistente ao aluno.

## 14. Handoff para Tech Lead
Avaliar a reutilização da máquina de estados de sucesso do cartão, garantindo que o Pix use a mesma transição somente após confirmação confiável do backend.
