# TASK-085 — Remover mensagens textuais de validação do formulário de cartão

TASK: TASK-085
STATUS: IMPLEMENTED
OWNER: MAZZI Product
LAST_UPDATED: 2026-08-28

---

## 1. Objetivo
Remover do formulário de cartão as mensagens textuais de validação no formato de alerta, como “CARACTERES DE DATA INVÁLIDOS”, deixando a interface mais limpa durante o preenchimento.

## 2. Problema
O formulário exibe mensagens vermelhas de validação que poluem o layout e podem aparecer enquanto o aluno ainda está digitando ou corrigindo os dados do cartão.

## 3. Usuário Afetado
Aluno.

## 4. Escopo
- Ocultar mensagens textuais de validação exibidas pelo formulário de cartão.
- Remover mensagens equivalentes para número, validade, CVV, nome, documento e e-mail.
- Preservar o estado visual de campo inválido e a validação que impede o envio de dados incorretos.
- Garantir que erros de pagamento ou de processamento continuem sendo apresentados pelo fluxo de checkout.

## 5. Fora de Escopo
- Alterar regras de validação do Mercado Pago.
- Aceitar cartão de débito.
- Alterar o gateway, o valor cobrado ou o fluxo de estorno.
- Remover mensagens de erro do pagamento após o envio do formulário.

## 6. Regras de Negócio
- **RN01**: Dados inválidos não podem ser enviados ao backend apenas porque o texto da validação foi ocultado.
- **RN02**: O campo inválido deve continuar identificável por estado visual e sem depender somente de cor.
- **RN03**: Falhas de autorização, rejeição ou processamento do pagamento permanecem visíveis ao aluno.
- **RN04**: A remoção deve valer para todas as mensagens textuais equivalentes dentro do formulário de cartão.

## 7. Fluxo Principal (Happy Path)
1. O aluno seleciona cartão e preenche os campos.
2. O formulário valida os dados sem exibir banners ou textos vermelhos de validação inline.
3. Campos inválidos permanecem marcados visualmente e o envio continua bloqueado até a correção.
4. Com os dados válidos, o pagamento segue normalmente.

## 8. Casos de Borda e Exceções
- Validade digitada parcialmente não deve gerar um alerta textual persistente.
- Um erro de processamento retornado pelo backend não deve ser ocultado por esta tarefa.
- O estado inválido deve continuar acessível via atributos/semântica apropriados do componente.
- A solução deve funcionar após remontagem do Brick ou troca de método de pagamento.

## 9. Estados de Erro e Mensagens
- Validação de campo: sem mensagem textual inline; manter indicação visual e semântica do campo.
- Pagamento rejeitado: manter a mensagem amigável do checkout.
- Falha técnica no pagamento: manter a mensagem amigável do checkout.

## 10. Critérios de Aceite
- **AC01**: O texto “CARACTERES DE DATA INVÁLIDOS” não aparece no formulário de cartão.
- **AC02**: Nenhuma mensagem textual equivalente de validação de campo aparece como alerta vermelho inline.
- **AC03**: O envio permanece bloqueado quando qualquer dado obrigatório é inválido.
- **AC04**: Campos inválidos continuam identificáveis sem depender apenas da cor.
- **AC05**: Mensagens de rejeição ou falha do pagamento continuam sendo exibidas.
- **AC06**: Cartão válido continua seguindo o fluxo de pagamento sem regressão.

## 11. Dependências
Componente `MercadoPagoCardCheckout`, SDK React do Mercado Pago e fluxo de checkout do aluno.

## 12. Decisões Pendentes
Definir se a indicação acessível será feita apenas pelo estado do campo ou também por uma mensagem compacta em região de ajuda fora do formulário.

## 13. Riscos de Produto
Ocultar feedback textual sem preservar semântica pode dificultar a correção dos dados por usuários com baixa visão ou leitores de tela.

## 14. Handoff para Tech Lead
Inspecionar a configuração e o DOM gerado pelo `CardPayment`; aplicar a menor customização suportada pelo SDK, preservando validação, acessibilidade e mensagens de resultado do pagamento.
