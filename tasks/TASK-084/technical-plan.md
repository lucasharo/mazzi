# Technical Plan — TASK-084

TASK: TASK-084
STATUS: IMPLEMENTED
OWNER: MAZZI Tech Lead
LAST_UPDATED: 2026-08-28

---

## 1. Resumo Técnico
Separar a criação do hold da reserva da criação da tentativa de pagamento. O checkout deverá aguardar a escolha explícita do método e manter uma única tentativa ativa por fluxo de pagamento.

## 2. Código Existente Relacionado
- `src/apps/student/components/CheckoutModal.tsx`
- `src/lib/db-service.ts`
- `supabase/migrations/20260828180000_fix_payment_method_attempt_idempotency.sql`
- `supabase/migrations/20260828203000_cancel_pending_booking.sql`
- `supabase/functions/process-mercadopago-pix-payment/index.ts`
- `supabase/functions/process-mercadopago-card-payment/index.ts`

## 3. Arquivos Provavelmente Afetados
- [MODIFY] `src/apps/student/components/CheckoutModal.tsx`
- [MODIFY] `src/lib/db-service.ts` (se necessário)
- [NEW/MODIFY] migration para ciclo de vida de tentativas não utilizadas, se necessário
- [MODIFY] testes de checkout e idempotência

## 4. Banco de Dados & Migrations
Avaliar um status próprio para tentativa abandonada ou o cancelamento transacional de uma tentativa pendente ao trocar de método. Não alterar dados de pagamentos já pagos.

## 5. RLS e RBAC Afetados
Nenhum previsto. A criação e atualização devem continuar restritas ao aluno dono da reserva e aos fluxos de serviço autorizados.

## 6. Estratégia de Implementação
1. Remover a criação automática baseada no estado inicial `PIX`.
2. Criar a tentativa somente no momento da seleção explícita ou no início real do pagamento.
3. Definir a transição segura de tentativas ao trocar de método.
4. Garantir que funções de confirmação e estorno selecionem somente o pagamento correto.
5. Cobrir o fluxo com testes de idempotência, abandono e troca de método.

## 7. Testes Obrigatórios
- [ ] Abrir checkout sem criar Pix.
- [ ] Selecionar cartão sem criar Pix.
- [ ] Selecionar Pix sem criar cartão.
- [ ] Trocar método e verificar encerramento da tentativa anterior.
- [ ] Confirmar que pagamento aprovado ainda confirma a reserva uma única vez.
- [ ] Confirmar que o estorno seleciona o pagamento aprovado correto.

## 8. Riscos e Mitigações
- **Risco**: liberar o horário sem hold. **Mitigação**: manter o hold transacional independente do pagamento.
- **Risco**: duplicar pagamento ao trocar de método. **Mitigação**: chave de idempotência por tentativa e método.
- **Risco**: selecionar tentativa errada no estorno. **Mitigação**: filtrar por status, método e ambiente elegíveis.

## 9. O que NÃO Alterar
Não alterar credenciais do Mercado Pago, valores de cobrança, regras de débito, política de estorno ou confirmação otimista no frontend.

## 10. Instruções para o MAZZI Dev
Reproduzir o caso do teste de produção antes de implementar e registrar a tentativa Pix não utilizada como evidência de regressão.
