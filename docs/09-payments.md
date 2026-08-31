## FASE ATUAL DO PROJETO (MVP VALIDATION MODE)
- **Modo de Pagamento**: alternável em DEV entre `fake` (padrão) e `stripe` por `VITE_PAYMENT_GATEWAY_PROVIDER`.
- **Dinheiro Real**: somente quando uma chave `STRIPE_SECRET_KEY` de produção estiver explicitamente configurada nos secrets do Supabase.
- **Stripe**: o ambiente é definido pela chave pública `pk_test_`/`pk_live_`; a chave secreta fica exclusivamente no servidor.
- **Estorno Stripe**: a solicitação é feita exclusivamente pela Edge Function autenticada do Admin, com chave de idempotência determinística; o gateway fake continua usando a simulação local.
- **Segurança & Idempotência**: O fluxo usa `fake_payment_gateway` com chave de idempotência `idem_pay_<booking_id>` e verificação transacional no banco PostgreSQL (`confirm_booking_payment` RPC).
- **Produção**: pagamentos reais exigem credenciais produtivas protegidas nos secrets do Supabase e webhook assinado para reconciliação.

## Direção de seleção do gateway

Foi realizada uma comparação inicial entre Mercado Pago, Stripe Connect, Asaas e Pagar.me para o modelo de marketplace da MAZZI. A decisão atual é usar **Stripe** no checkout customizado, com Payment Element para cartão e Pix e webhook assinado para confirmação.

O custo efetivo deverá considerar método de pagamento, parcelamento, prazo de recebimento, antecipação, chargebacks, estornos e cada repasse ao prestador. A ativação de produção exige validação comercial e operacional antes de cobrar clientes reais.

O ambiente DEV pode executar chamadas com credenciais de teste. Não há autorização para credenciais ou cobranças de produção.

## Checkout online de teste — TASK-079 e TASK-080

- O modo Stripe oferece cartão e Pix pelo Payment Element usando métodos de pagamento dinâmicos. O Pix exibe QR Code/copia e cola e permanece `PENDING` até confirmação posterior.
- O Stripe Elements tokeniza os dados sensíveis; o MAZZI recebe somente o `client_secret` do PaymentIntent autenticado.
- A Edge Function autenticada ignora valores do browser, usa `payments.amount_in_cents` e envia uma chave de idempotência ao Stripe.
- Somente uma confirmação server-side aprovada confirma a reserva; `pending`, `in_process` ou rejeição mantêm a reserva não confirmada.
- A chave pública fica em `VITE_STRIPE_PUBLISHABLE_KEY`; `STRIPE_SECRET_KEY` fica somente nos secrets do Supabase.
- Em builds com `pk_test_`, a telemetria avançada opcional do Stripe é desativada para evitar falha de DNS em `m.stripe.com`; as proteções continuam ativas nos builds com `pk_live_`.
- Pix precisa estar habilitado no Stripe Dashboard em **Settings > Payment methods** em cada ambiente. Se `pix.available=false`, a API rejeita o PaymentIntent e não existe QR Code para exibir.
- Quando o Stripe recusa a criação do PaymentIntent, a tentativa local é marcada como `FAILED` e a reserva continua `PENDING_PAYMENT`, permitindo tentar outro método sem deixar pagamentos pendentes órfãos.
- A Edge Function não envia `payment_method_types[]=pix`; ela usa `automatic_payment_methods[enabled]=true` e verifica se o método solicitado está disponível antes de entregar o `client_secret`.

## Recebimento Pix e repasse manual — TASK-080

- O gateway é selecionado por `VITE_PAYMENT_GATEWAY_PROVIDER=fake|stripe`; `fake` continua sendo o padrão seguro.
- A criação do Pix é online, mas a confirmação é posterior: o aluno permanece em `Aguardando pagamento` até o webhook assinado ou a atualização manual consultar o status autoritativo.
- O webhook Stripe configurado para esta integração recebe eventos de `payment_intent.*`, reembolsos e disputas. A assinatura é validada antes de qualquer alteração local.
- O backend valida valor em centavos, aluno/reserva, expiração, assinatura e idempotência antes de confirmar a reserva.
- O PRO cadastra sua conta bancária no próprio app. O Admin vê repasses somente de reservas pagas e concluídas e registra o repasse manual com referência. Chaves Pix cadastradas antes desta mudança permanecem legíveis apenas como legado.
- Split automático, OAuth e transferência Pix automática continuam fora desta entrega.

## Estorno real no sandbox

- O Admin pode solicitar um estorno integral de um pagamento Stripe pela Edge Function `process-stripe-refund`.
- A função valida sessão, permissão `PLATFORM_ADMIN`, estado do pagamento e identificador externo antes de chamar `POST /v1/refunds`.
- A chave de idempotência é derivada do pagamento e do valor restante, evitando uma segunda devolução em retries.
- O lançamento contábil local usa `process_booking_refund` somente após confirmação do Stripe; respostas assíncronas permanecem pendentes e são reconciliadas pelo webhook.
- A função e a migration precisam ser publicadas no projeto DEV antes de o botão operar contra o sandbox. Nenhuma credencial privada é enviada ao frontend.

## Stripe Connect / Split (futuro)

Este cenário permanece apenas como referência para uma fase posterior. A implementação atual não usa Connect, split automático nem transferência bancária automática.

Para uma futura fase de marketplace, o modelo poderá operar com contas conectadas Stripe:

- **Aluno**: cliente do checkout.
- **PRO / Prestador**: conta conectada que recebe o repasse.
- **MAZZI**: plataforma responsável pela cobrança e comissão.

O fluxo correto para split 1:1 é:

1. O PRO conclui o onboarding da conta conectada Stripe.
2. O backend salva somente o identificador da conta conectada e seus estados de capacidade.
3. A Edge Function cria o PaymentIntent no contexto definido pela plataforma.
4. A comissão da MAZZI é calculada em centavos e aplicada conforme a configuração do Connect.
5. O Stripe liquida a parte do prestador e a parte da MAZZI conforme as responsabilidades definidas.

## Interface Abstrata: `PaymentGateway`
O domínio MAZZI é completamente desacoplado de provedores específicos.

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
- Repasse Líquido ao Fornecedor: total bruto menos taxa do Stripe e comissão MAZZI efetiva, com limite combinado configurável.

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
