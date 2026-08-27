## FASE ATUAL DO PROJETO (MVP VALIDATION MODE)
- **Modo de Pagamento**: `MOCK_VALIDATION` (Fake Payment Gateway).
- **Dinheiro Real**: NÃO (Nenhum valor financeiro real é cobrado ou enviado para rede externa).
- **Mercado Pago Real**: FUTURO / DESABILITADO; só pode ser ativado mediante solicitação explícita futura do Product/User.
- **Segurança & Idempotência**: O fluxo usa `fake_payment_gateway` com chave de idempotência `idem_pay_<booking_id>` e verificação transacional no banco PostgreSQL (`confirm_booking_payment` RPC).
- **Produção Futura (Pagamentos Reais)**: se houver solicitação explícita futura, o gateway real Mercado Pago utilizará exclusivamente webhooks e assinaturas criptográficas do backend confiável como fonte de verdade.

## Direção de seleção do gateway

Foi realizada uma comparação inicial entre Mercado Pago, Stripe Connect, Asaas e Pagar.me para o modelo de marketplace da MAZZI. A recomendação inicial é avaliar primeiro o **Mercado Pago**, pela aderência ao mercado brasileiro, disponibilidade de Pix, cartão, parcelamento e split nativo para marketplace.

Essa recomendação ainda não é uma decisão de ativação nem substitui uma proposta comercial. O custo efetivo deverá considerar método de pagamento, parcelamento, prazo de recebimento, antecipação, chargebacks, estornos e cada repasse ao prestador. O Mercado Pago documenta split 1:1 para Checkout Pro e Checkout Transparente, com vínculo dos vendedores por OAuth e comissão da plataforma configurada na cobrança.

Até que a contratação, a homologação técnica e a validação jurídica sejam concluídas, o gateway real permanece desabilitado e o ambiente continua em `MOCK_VALIDATION`.

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

## Critérios obrigatórios para ativação futura

- Adaptador real executado somente no backend, sem credenciais privadas no frontend.
- Webhooks com assinatura criptográfica, idempotência e reconciliação transacional.
- Split, repasse após conclusão da aula, estorno parcial/total e chargeback testados em sandbox.
- Onboarding e verificação dos prestadores, responsabilidades operacionais e fluxo de suporte definidos.
- Comissão comercial da MAZZI e política financeira aprovadas pela diretoria.
- Checklist jurídico, LGPD, termos de uso e política de reembolso concluídos.
