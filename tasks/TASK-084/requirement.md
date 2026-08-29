# TASK-084 — Não criar tentativa de Pix sem seleção explícita

TASK: TASK-084
STATUS: IMPLEMENTED
OWNER: MAZZI Product
LAST_UPDATED: 2026-08-28

---

## 1. Objetivo
Impedir que o checkout crie uma tentativa de pagamento Pix quando o aluno ainda não escolheu Pix.

## 2. Problema
O checkout inicia com Pix selecionado por padrão e cria uma tentativa de Pix durante a reserva. Se o aluno escolher cartão depois, uma segunda tentativa é criada, deixando um Pix pendente que nunca foi solicitado.

## 3. Usuário Afetado
Aluno e Administrador.

## 4. Escopo
- Não criar tentativa de pagamento antes da escolha explícita do aluno.
- Criar a tentativa somente quando o aluno selecionar Pix ou Cartão de Crédito.
- Ao trocar de método, impedir tentativas pendentes sem uso ou marcá-las corretamente como abandonadas.
- Garantir que o Admin e os relatórios não apresentem uma tentativa Pix que não foi usada.

## 5. Fora de Escopo
- Alterar as regras de aprovação do Mercado Pago.
- Habilitar cartão de débito.
- Alterar valores, taxas, estornos ou o webhook.

## 6. Regras de Negócio
- **RN01**: A seleção padrão não deve ser interpretada como intenção confirmada de pagamento.
- **RN02**: Uma tentativa só deve ser criada para o método explicitamente escolhido.
- **RN03**: Trocar de método não pode deixar uma tentativa concorrente ativa sem necessidade.
- **RN04**: A confirmação da reserva continua dependendo do pagamento aprovado pelo backend.

## 7. Fluxo Principal (Happy Path)
1. O aluno abre o checkout e escolhe a forma de pagamento.
2. O MAZZI cria uma única tentativa para o método selecionado.
3. O aluno realiza o pagamento.
4. O backend confirma o pagamento e a reserva.

## 8. Casos de Borda e Exceções
- O aluno troca de Pix para cartão: a tentativa Pix não deve permanecer ativa sem uso.
- O aluno troca de cartão para Pix: somente a tentativa Pix atual deve ser apresentada.
- O aluno abandona o checkout: nenhuma tentativa de pagamento não utilizada deve ficar como ativa.
- Repetição da mesma ação: respeitar idempotência.

## 9. Estados de Erro e Mensagens
- Método não selecionado: "Selecione uma forma de pagamento para continuar."
- Tentativa anterior abandonada: não exibir erro; apenas impedir sua reutilização indevida.

## 10. Critérios de Aceite
- **AC01**: Abrir o checkout não cria uma tentativa Pix automaticamente.
- **AC02**: Escolher cartão cria somente uma tentativa de cartão.
- **AC03**: Escolher Pix cria somente uma tentativa Pix.
- **AC04**: Trocar o método não deixa tentativas pendentes sem uso como ativas.
- **AC05**: A reserva só é confirmada por pagamento aprovado no backend.
- **AC06**: O fluxo continua idempotente e sem dupla cobrança.

## 11. Dependências
Checkout do aluno, criação de pagamentos, tabela `payments`, RPC `create_booking_payment` e visualização financeira do Admin.

## 12. Decisões Pendentes
Definir se tentativas não utilizadas serão canceladas, expiradas ou mantidas para auditoria com status específico.

## 13. Riscos de Produto
Tentativas falsas podem confundir o aluno, poluir o financeiro e dificultar a identificação do pagamento correto para estorno.

## 14. Handoff para Tech Lead
Priorizar a separação entre reserva de horário e intenção de pagamento, preservando a trava da reserva e a idempotência dos pagamentos.
