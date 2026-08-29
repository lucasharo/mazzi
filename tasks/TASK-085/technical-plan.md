# Technical Plan — TASK-085

TASK: TASK-085
STATUS: IMPLEMENTED
OWNER: MAZZI Tech Lead
LAST_UPDATED: 2026-08-28

---

## 1. Resumo Técnico
Ajustar o componente de cartão para não apresentar mensagens textuais de validação geradas durante o preenchimento, sem desativar a validação do SDK nem esconder erros de processamento do pagamento.

## 2. Código Existente Relacionado
- `src/apps/student/components/MercadoPagoCardCheckout.tsx`
- `src/apps/student/components/CheckoutModal.tsx`
- `src/lib/payment-gateway-config.ts`

## 3. Arquivos Provavelmente Afetados
- [MODIFY] `src/apps/student/components/MercadoPagoCardCheckout.tsx`
- [MODIFY, se necessário] `src/apps/student/components/CheckoutModal.tsx`
- [NEW/MODIFY] testes do checkout de cartão, conforme a estrutura existente

## 4. Banco de Dados & Migrations
N/A. A tarefa é exclusivamente de apresentação e interação do formulário.

## 5. RLS e RBAC Afetados
N/A.

## 6. Estratégia de Implementação
1. Reproduzir cada estado inválido do `CardPayment` e identificar se a mensagem é controlada por configuração do SDK ou inserida no DOM.
2. Preferir configuração oficial/estilo encapsulado do componente; evitar manipulação global que afete outros formulários.
3. Preservar `aria-invalid`, foco, bloqueio de submit e feedback visual acessível.
4. Garantir que `errorMessage` do checkout continue funcionando para rejeição e falha de pagamento.
5. Testar preenchimento parcial, correção, troca de método e remontagem do componente.

## 7. Testes Obrigatórios
- [ ] Teste visual: validade inválida não exibe texto vermelho de validação.
- [ ] Teste de interação: dados inválidos impedem o envio.
- [ ] Teste de acessibilidade: campo inválido permanece semanticamente identificável.
- [ ] Teste de regressão: cartão válido segue para o handler de pagamento.
- [ ] Teste de regressão: erro de pagamento continua visível.

## 8. Riscos e Mitigações
- O SDK pode não oferecer configuração oficial para ocultar textos; encapsular a regra no contêiner do cartão e validar em cada atualização do SDK.
- Esconder elementos por CSS pode deixar conteúdo acessível de forma incoerente; validar com leitor de tela e atributos ARIA.
- Seletores frágeis do DOM podem quebrar após atualização do Brick; documentar a dependência e preferir APIs públicas.

## 9. O que NÃO Alterar
- Validação server-side ou Edge Functions.
- Tokenização e envio do cartão.
- Regras de confirmação da reserva.
- Mensagens de rejeição, falha técnica ou status do pagamento.

## 10. Instruções para o MAZZI Dev
Implementar somente após a tarefa sair de `BACKLOG`. Não substituir a validação por uma máscara permissiva e não usar `window.alert` para compensar a remoção do texto inline.
