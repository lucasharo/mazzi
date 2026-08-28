## FASE ATUAL DO PROJETO (MVP VALIDATION MODE)
- **Modo de Pagamento**: alternável em DEV entre `fake` (padrão) e `mercadopago` por `VITE_PAYMENT_GATEWAY_PROVIDER`.
- **Dinheiro Real**: NÃO (Nenhum valor financeiro real é cobrado ou enviado para rede externa).
- **Mercado Pago em DEV**: habilitado somente para homologação com Card Payment Brick ou Pix, credenciais de teste e `MERCADOPAGO_ENVIRONMENT=test`.
- **Segurança & Idempotência**: O fluxo usa `fake_payment_gateway` com chave de idempotência `idem_pay_<booking_id>` e verificação transacional no banco PostgreSQL (`confirm_booking_payment` RPC).
- **Produção Futura (Pagamentos Reais)**: continua desabilitada. Webhooks assinados permanecem obrigatórios antes de uma futura ativação produtiva para reconciliação e eventos posteriores.

## Direção de seleção do gateway

Foi realizada uma comparação inicial entre Mercado Pago, Stripe Connect, Asaas e Pagar.me para o modelo de marketplace da MAZZI. A recomendação inicial é avaliar primeiro o **Mercado Pago**, pela aderência ao mercado brasileiro, disponibilidade de Pix, cartão, parcelamento e split nativo para marketplace.

Essa recomendação ainda não é uma decisão de ativação nem substitui uma proposta comercial. O custo efetivo deverá considerar método de pagamento, parcelamento, prazo de recebimento, antecipação, chargebacks, estornos e cada repasse ao prestador. O Mercado Pago documenta split 1:1 para Checkout Pro e Checkout Transparente, com vínculo dos vendedores por OAuth e comissão da plataforma configurada na cobrança.

O ambiente DEV pode executar chamadas com credenciais de teste. Não há autorização para credenciais ou cobranças de produção.

## Checkout online de teste — TASK-079 e TASK-080

- O modo Mercado Pago oferece cartão e Pix de teste. O Pix exibe QR Code/copia e cola e permanece `PENDING` até confirmação posterior.
- O Brick oficial tokeniza PAN/CVV; o MAZZI recebe somente token temporário.
- A Edge Function autenticada ignora valores do browser, usa `payments.amount_in_cents` e envia `X-Idempotency-Key`.
- Somente uma confirmação server-side aprovada confirma a reserva; `pending`, `in_process` ou rejeição mantêm a reserva não confirmada.
- A chave pública fica em `VITE_MERCADOPAGO_PUBLIC_KEY`; Access Token fica somente nos secrets do Supabase.

## Recebimento Pix e repasse manual — TASK-080

- O gateway é selecionado por `VITE_PAYMENT_GATEWAY_PROVIDER=fake|mercadopago`; `fake` continua sendo o padrão seguro.
- A criação do Pix é online, mas a confirmação é posterior: o aluno permanece em `Aguardando pagamento` até o webhook assinado ou a atualização manual consultar o status autoritativo.
- O webhook configurado para esta integração deve receber notificações de pagamento (`payment.updated`). Eventos de Orders (`order.processed`) são aceitos e ignorados porque não pertencem ao fluxo Pix atual.
- O backend valida valor em centavos, aluno/reserva, expiração, assinatura e idempotência antes de confirmar a reserva.
- O PRO cadastra sua chave Pix no próprio app. O Admin vê repasses somente de reservas pagas e concluídas e registra o repasse manual com referência.
- Split automático, OAuth e transferência Pix automática continuam fora desta entrega.

## Mercado Pago Marketplace / Split 1:1 (futuro)

Este cenário permanece apenas como referência para uma fase posterior. A implementação atual não usa OAuth, split automático nem transferência Pix automática.

Para uma futura fase de marketplace, o modelo poderia operar com três contas de teste no Mercado Pago:

- **Aluno**: comprador de teste usado no checkout.
- **PRO / Prestador**: vendedor que autoriza a MAZZI via OAuth.
- **MAZZI**: integrador/marketplace, dono da aplicação e da chave pública usada no frontend.

O fluxo correto para split 1:1 é:

1. O PRO conecta sua conta Mercado Pago à MAZZI via OAuth, caso essa decisão seja aprovada futuramente.
2. O backend salva, de forma privada, o `access_token` do vendedor vinculado ao prestador.
3. O checkout no app Aluno usa a `public_key` da conta integradora MAZZI.
4. A Edge Function cria o pagamento usando o `access_token` do vendedor/PRO.
5. A comissão da MAZZI é enviada na cobrança como taxa de marketplace (`marketplace_fee`), calculada em centavos a partir de `platform_fee_in_cents`.
6. O Mercado Pago liquida a parte do vendedor e a parte da MAZZI conforme a configuração da cobrança e as regras da conta de teste.

Enquanto `MERCADOPAGO_ENVIRONMENT=test`, somente contas e cartões de teste podem ser usados. Credenciais produtivas seguem proibidas neste ambiente.

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
- **Comissão MAZZI:** Percentual configurável pelo Admin, limitado pelo teto combinado de taxas.
- Total Pago pelo Aluno (`total_in_cents`): valor final congelado na cotação/reserva.
- Repasse Líquido ao Fornecedor: total bruto menos taxa do Mercado Pago e comissão MAZZI efetiva, com limite combinado configurável.

## Ciclo de Vida do Repasse (Payout)
1. `PENDING`: Criado quando a reserva é paga e ainda aguarda o período de segurança.
2. `AVAILABLE`: Liberado automaticamente 24h após a aula ter status `COMPLETED`.
3. `PAID`: Repasse manual confirmado pelo Admin com referência.
4. `BLOCKED`: Destino Pix ausente ou bloqueio financeiro que exige tratamento do Admin.

## Critérios obrigatórios para ativação futura

- Adaptador real executado somente no backend, sem credenciais privadas no frontend.
- Webhooks com assinatura criptográfica, idempotência e reconciliação transacional.
- Split, repasse após conclusão da aula, estorno parcial/total e chargeback testados em sandbox.
- Onboarding e verificação dos prestadores, responsabilidades operacionais e fluxo de suporte definidos.
- Comissão comercial da MAZZI e política financeira aprovadas pela diretoria.
- Checklist jurídico, LGPD, termos de uso e política de reembolso concluídos.
