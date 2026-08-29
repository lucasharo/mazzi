# Technical Plan — TASK-083

TASK: TASK-083
STATUS: IMPLEMENTED
OWNER: MAZZI Tech Lead
LAST_UPDATED: 2026-08-28

---

## 1. Resumo Técnico
Atualizar o label da opção `CREDIT_CARD` no checkout do aluno, mantendo o tipo interno e toda a integração inalterados.

## 2. Código Existente Relacionado
- `src/apps/student/components/CheckoutModal.tsx`
- `src/apps/student/components/MercadoPagoCardCheckout.tsx`

## 3. Arquivos Provavelmente Afetados
- [MODIFY] `src/apps/student/components/CheckoutModal.tsx`
- [MODIFY] testes de texto/checkout, se existentes

## 4. Banco de Dados & Migrations
N/A.

## 5. RLS e RBAC Afetados
Nenhum.

## 6. Estratégia de Implementação
1. Localizar todos os labels visíveis que representam `CREDIT_CARD`.
2. Substituir somente o texto por **Cartão de Crédito**.
3. Confirmar que não existe opção ou label de débito.
4. Executar testes e build dos apps.

## 7. Testes Obrigatórios
- [ ] Teste do label Cartão de Crédito.
- [ ] Teste de presença exclusiva das opções Pix e Cartão de Crédito.
- [ ] Regressão do pagamento com cartão.

## 8. Riscos e Mitigações
- **Risco**: alterar o valor interno do método. **Mitigação**: modificar somente o texto renderizado.

## 9. O que NÃO Alterar
Não alterar `PaymentMethodType`, Edge Functions, Mercado Pago, débito ou estornos.

## 10. Instruções para o MAZZI Dev
Manter o suporte a débito bloqueado e fazer uma alteração exclusivamente textual no checkout.
