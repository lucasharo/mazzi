## FASE ATUAL DO PROJETO (MVP VALIDATION MODE)
- **Modo de Pagamento**: `MOCK_VALIDATION` (Fake Payment Gateway).
- **Dinheiro Real**: NÃO (Nenhum valor financeiro real é cobrado ou enviado para rede externa).
- **Mercado Pago Real**: POSTERGADO para fase pós-MVP.
- **Segurança & Idempotência**: O fluxo usa `fake_payment_gateway` com chave de idempotência `idem_pay_<booking_id>` e verificação transacional no banco PostgreSQL (`confirm_booking_payment` RPC).
- **Produção Futura (Pagamentos Reais)**: O gateway real Mercado Pago utilizará exclusivamente webhooks e assinaturas criptográficas do backend confiável (trusted backend) como única fonte de verdade.

## Interface Abstrata: `PaymentGateway`
O domínio MAZZI é completamente desacoplado de provedores específicos (como Asaas, Pagar.me, Stripe ou Mercado Pago).

```typescript
export interface PaymentGateway {
  createPayment(params: CreatePaymentInput): Promise<PaymentResult>;
  getPayment(transactionId: string): Promise<PaymentDetails>;
  refundPayment(transactionId: string, amountInCents?: number): Promise<RefundResult>;
  createPayout(params: CreatePayoutInput): Promise<PayoutResult>;
  verifyWebhookSignature(payload: string, signature: string): boolean;
  parseWebhookEvent(body: any): WebhookEvent;
}
```

## Modelo Financeiro (Tudo em Centavos)
- Preço da Aula (`price_in_cents`): Definido pelo Fornecedor na Oferta (ex: R$ 120,00 = `12000`).
- Taxa de Plataforma MAZZI (`platform_fee_in_cents`): Percentual configurável administrativamente via backend.
- **[DECISÃO PENDENTE]:** O percentual definitivo de comissão comercial MAZZI será definido pela diretoria. O valor de 10% (`DEFAULT_DEVELOPMENT_PLATFORM_FEE_PERCENTAGE`) é meramente referencial para desenvolvimento e testes.
- Total Pago pelo Aluno (`total_in_cents`): `price_in_cents + platform_fee_in_cents` (ou conforme política de *take rate* embutido).
- Repasse Líquido ao Fornecedor: `price_in_cents` (ou `total - fee`).

## Ciclo de Vida do Repasse (Payout)
1. `PENDING`: Criado no momento da confirmação do pagamento.
2. `AVAILABLE`: Liberado automaticamente 24h após a aula ter status `COMPLETED`.
3. `PROCESSING`: Enviado para processamento bancário via PIX/TED.
4. `PAID`: Confirmado pelo banco/gateway.
5. `BLOCKED`: Em caso de contestação, chargeback ou suspeita de fraude em análise.
