# Technical Plan — TASK-081

TASK: TASK-081
STATUS: IMPLEMENTED
OWNER: MAZZI Tech Lead
LAST_UPDATED: 2026-08-28

---

## 1. Resumo Técnico
Reaproveitar o estado de sucesso já existente no `CheckoutModal` para o fluxo Pix, garantindo que a transição seja iniciada somente quando a resposta do backend indicar pagamento confirmado e reserva confirmada. O polling precisa consultar o status do Pix no gateway ou disparar a mesma reconciliação confiável usada pelo botão manual.

## 2. Código Existente Relacionado
- `src/apps/student/components/CheckoutModal.tsx`
- `src/apps/student/components/MercadoPagoPixCheckout.tsx`
- `src/lib/db-service.ts`
- `supabase/functions/process-mercadopago-pix-payment/index.ts`
- `supabase/functions/mercadopago-payment-webhook/index.ts`

## 3. Arquivos Provavelmente Afetados
- [MODIFY] `src/apps/student/components/CheckoutModal.tsx`
- [MODIFY] `src/apps/student/components/MercadoPagoPixCheckout.tsx` (se necessário)
- [MODIFY] testes do fluxo de checkout Pix

## 4. Banco de Dados & Migrations
N/A. A tarefa não deve alterar o modelo de pagamento nem a confirmação transacional.

## 5. RLS e RBAC Afetados
Nenhum. As consultas e confirmações existentes devem continuar sendo executadas pelos fluxos autorizados.

## 6. Estratégia de Implementação
1. Mapear o caminho comum de sucesso do cartão e o caminho de confirmação do Pix.
2. Centralizar a transição visual para que ambos usem a mesma sequência `LOADING → TRANSITION → COMPLETE`.
3. Corrigir e cobrir a atualização automática do Pix, garantindo que ela não dependa somente de `get_my_payment_status`, que pode continuar pendente até a conciliação local.
4. Cobrir confirmação via atualização manual, polling e webhook sem confirmação otimista.
5. Validar o comportamento visual e a estabilidade do layout em telas móveis.

## 7. Testes Obrigatórios
- [ ] Teste unitário para Pix confirmado iniciar a animação.
- [ ] Teste unitário para Pix pendente não iniciar a animação.
- [ ] Teste de integração para confirmação por webhook.
- [ ] Teste de integração para refresh automático após pagamento Pix aprovado.
- [ ] Teste de regressão do fluxo de cartão.

## 8. Riscos e Mitigações
- **Risco**: duplicar a confirmação após polling e webhook. **Mitigação**: manter a transição idempotente pelo estado da reserva.
- **Risco**: mostrar sucesso antes da persistência. **Mitigação**: exigir `PAID` e `CONFIRMED` retornados pelo backend.

## 9. O que NÃO Alterar
Não alterar valores, estornos, webhooks, regras de expiração, credenciais ou o modal final branco.

## 10. Instruções para o MAZZI Dev
Implementar somente após validar o comportamento atual do pagamento Pix e reutilizar componentes/estilos existentes sempre que possível.
