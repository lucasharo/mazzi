## FASE ATUAL DO PROJETO (MVP VALIDATION MODE)
- **Modo de Pagamento**: alternável em DEV entre `fake` (padrão) e `stripe` por `VITE_PAYMENT_GATEWAY_PROVIDER`.
- **Dinheiro Real**: somente quando uma chave `STRIPE_SECRET_KEY` de produção estiver explicitamente configurada nos secrets do Supabase.
- **Stripe**: o ambiente é definido pela chave pública `pk_test_`/`pk_live_`; a chave secreta fica exclusivamente no servidor.
- **Estorno Stripe**: a solicitação é feita exclusivamente pela Edge Function autenticada do Admin, com chave de idempotência determinística; o gateway fake continua usando a simulação local.
- **Segurança & Idempotência**: O fluxo usa `fake_payment_gateway` com chave de idempotência `idem_pay_<booking_id>` e verificação transacional no banco PostgreSQL (`confirm_booking_payment` RPC).
- **Produção**: pagamentos reais exigem credenciais produtivas protegidas nos secrets do Supabase e webhook assinado para reconciliação.

## Direção de seleção do gateway

Foi realizada uma comparação inicial entre Mercado Pago, Stripe Connect, Asaas e Pagar.me para o modelo de marketplace da MAZZI. A decisão atual é usar **Stripe** com Checkout hospedado externo para cartão e Pix e webhook assinado para confirmação.

O custo efetivo deverá considerar método de pagamento, parcelamento, prazo de recebimento, antecipação, chargebacks, estornos e cada repasse ao prestador. A ativação de produção exige validação comercial e operacional antes de cobrar clientes reais.

O ambiente DEV pode executar chamadas com credenciais de teste. Não há autorização para credenciais ou cobranças de produção.

## Checkout online de teste — TASK-079 e TASK-080

- O modo Stripe usa o Checkout hospedado da Stripe: o aluno escolhe uma preferência no MAZZI, e o clique em pagar cria uma Checkout Session e redireciona para a página externa segura da Stripe.
- A Edge Function autenticada ignora valores do browser, usa `payments.amount_in_cents`, envia uma chave de idempotência e associa `payment_id`/`booking_id` por metadata.
- A reserva retorna ao app após o checkout para uma tela dedicada de confirmação, mas a confirmação continua dependente do webhook assinado; o retorno do navegador nunca confirma pagamento sozinho.
- Somente uma confirmação server-side aprovada confirma a reserva; `pending`, `in_process` ou rejeição mantêm a reserva não confirmada.
- `STRIPE_SECRET_KEY` fica somente nos secrets do Supabase; a Checkout Session não expõe credenciais privadas ao browser.
- Pix precisa estar habilitado no Stripe Dashboard em **Settings > Payment methods** em cada ambiente. Se o método não estiver disponível, a API rejeita a Checkout Session e não cria uma cobrança.
- Quando o Stripe recusa a criação da Checkout Session, a tentativa local permanece sem cobrança externa e a reserva continua `PENDING_PAYMENT`, permitindo tentar novamente sem deixar sessão órfã.
- A Edge Function de Checkout usa métodos dinâmicos gerenciados pela Stripe, deixando o aluno escolher Pix ou cartão dentro do Checkout hospedado. Pix aparece automaticamente quando estiver habilitado e elegível para a conta; se estiver indisponível, a Stripe mostra apenas os métodos elegíveis.

## Recebimento Pix e repasse manual — TASK-080

- O gateway é selecionado por `VITE_PAYMENT_GATEWAY_PROVIDER=fake|stripe`; `fake` continua sendo o padrão seguro.
- A criação do Pix é online, mas a confirmação é posterior: o aluno permanece em `Aguardando pagamento` até o webhook assinado ou a atualização manual consultar o status autoritativo.
- A cotação continua encerrando novas tentativas no prazo configurado (10 minutos no DEV). Se o pagamento for iniciado antes desse limite, o backend estende atomicamente o bloqueio do horário por cinco minutos para absorver atraso do gateway; `payment_started_at` e `payment_processing_until` registram essa janela.
- Se a confirmação chegar depois da janela de processamento, a reserva não é reativada. O webhook registra o pagamento tardio e solicita o reembolso integral com chave de idempotência; a transação local só é marcada como reembolsada depois da confirmação do gateway.
- O webhook Stripe configurado para esta integração recebe eventos de `checkout.session.*`, `payment_intent.*`, reembolsos e disputas. A assinatura é validada antes de qualquer alteração local.
- Repasses usam Stripe Connect com cobrança e transferência separadas. A transferência é criada somente após a aula concluída, vencimento da retenção configurável (72h por padrão) e ausência de disputa ativa.
- O processador de repasses usa chave de idempotência por reserva e execução periódica via Supabase Cron + Edge Function. Uma disputa aberta dentro da retenção bloqueia o payout no mesmo fluxo transacional.
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

### Taxa real do checkout e comissão efetiva da MAZZI

- A taxa da empresa de checkout não é calculada pelo percentual estimado da configuração. Após a confirmação, o webhook do Stripe consulta a tarifa real da cobrança no `balance_transaction` e grava o valor em `payments.gateway_fee_in_cents`.
- O teto combinado continua sendo o percentual configurado em `max_total_fee_percentage` (10% no padrão de desenvolvimento).
- A comissão efetiva da MAZZI é calculada em centavos como `teto combinado - taxa real do checkout`, respeitando também a comissão congelada na reserva:

```text
taxa_mazzi_efetiva = min(
  platform_fee_in_cents,
  max(0, total_in_cents × max_total_fee_percentage / 100 - gateway_fee_in_cents)
)
líquido_prestador = total_in_cents - gateway_fee_in_cents - taxa_mazzi_efetiva
```

O frontend não exibe a taxa estimada como se fosse a taxa real. Enquanto o gateway ainda não retornar a tarifa, o detalhamento informa que o valor será definido após o pagamento.

## Ciclo de Vida do Repasse (Payout)
1. `PENDING`: Criado quando a reserva é paga e ainda aguarda o período de segurança.
2. `AVAILABLE`: Liberado automaticamente 24h após a aula ter status `COMPLETED`.
3. `PAID`: Repasse manual confirmado pelo Admin com referência.
4. `BLOCKED`: Destino Pix ausente ou bloqueio financeiro que exige tratamento do Admin.

## Fundo de mediação e reserva prudencial para contestações

> Status: `REQUIRES_REGULATORY_VALIDATION` — política financeira documentada, ainda não autorizada para produção.

- Existem dois mecanismos financeiros distintos e eles não podem ser tratados como um único saldo:
  1. **Fundo de mediação / goodwill:** dinheiro próprio da MAZZI destinado a acordos voluntários quando aluno e prestador têm responsabilidade parcial e a plataforma decide não prejudicar integralmente nenhum dos lados.
  2. **Reserva de exposição financeira:** cobertura para reembolsos pendentes, chargebacks, tarifas, saldos negativos e demais obrigações vinculadas ao volume transacionado.

### Regra percentual do fundo de mediação

- O aporte mensal de referência deve ficar entre **2% e 5% da receita líquida da MAZZI** (`take rate`/comissão efetivamente reconhecida), e não entre 2% e 5% do GMV total.
- Para a fase inicial, o parâmetro prudencial proposto é **5% da receita líquida mensal**, sujeito a aprovação financeira e jurídica. O percentual poderá ser reduzido somente depois de existir histórico estatisticamente útil.
- Como o volume inicial pode ser baixo, o percentual isolado não é suficiente. Antes da operação real, a MAZZI deve constituir um saldo inicial capaz de cobrir pelo menos o pior caso de mediação previsto pela política comercial.
- O dimensionamento deve considerar uma incidência grave estimada entre **1% e 3% das aulas**, multiplicada pelo custo médio que a MAZZI assume em cada acordo:

```text
aporte_mensal_goodwill = receita_líquida_mazzi × percentual_goodwill

perda_esperada_mensal = quantidade_de_aulas
                      × taxa_de_incidentes_graves
                      × custo_médio_assumido_por_incidente

meta_do_fundo = máximo(
  saldo_mínimo_para_o_pior_caso_aprovado,
  perdas_esperadas_do_horizonte_de_segurança
)
```

- O Admin deve permitir configurar `percentual_goodwill`, saldo mínimo, teto operacional por caso e horizonte de segurança. Todas as grandezas monetárias permanecem em centavos inteiros.
- Um teto por disputa pode limitar a **cortesia adicional** assumida pela MAZZI. Casos acima do teto exigem análise administrativa reforçada. Esse teto nunca restringe reembolso, garantia ou direito obrigatório previsto em lei, contrato ou regra do meio de pagamento (`LEGAL_OVERRIDE`).
- Limites de frequência por usuário podem ser usados somente contra abuso do benefício voluntário. Eles não podem impedir reclamações, chargebacks legítimos ou direitos legais do consumidor.

### Reserva de exposição financeira e chargebacks

- A Stripe não estabelece percentual universal para chargebacks. Valor e prazo dependem da exposição, taxa histórica de reembolsos/contestações, ticket médio, prazo do serviço e tolerância a risco.
- Esta reserva não pode ser calculada apenas sobre a comissão da MAZZI, pois uma contestação bancária pode alcançar o valor integral da transação, tarifas não recuperáveis e custos operacionais.
- A reserva de exposição deve ser calculada em centavos inteiros pela fórmula:

```text
reserva_de_exposição = exposição_conhecida + buffer_de_risco

exposição_conhecida = disputas_abertas
                    + reembolsos_pendentes
                    + chargebacks_não_recuperados
                    + demais_saldos_negativos_de_responsabilidade_da_plataforma

buffer_de_risco = percentual_de_reserva × GMV_ainda_exposto
```

- `GMV_ainda_exposto` representa pagamentos que ainda podem gerar reembolso ou contestação dentro da janela aplicável.
- Saques, distribuição de lucros ou retirada de caixa só podem usar o **caixa livre**, definido como saldo disponível menos fundo de mediação, reserva de exposição, obrigações tributárias, valores de terceiros, pagamentos pendentes e capital de giro mínimo.
- A documentação da Stripe apresenta **30% por 30 dias** somente como exemplo de uma conta com determinada tolerância a risco. Também apresenta alternativas como 20% por 45 dias ou 40% por 10 dias. Esses números são ilustrações de calibragem, não recomendação universal nem percentual aprovado para a MAZZI.
- O percentual definitivo, saldo inicial e teto por mediação serão aprovados após simulação com ticket médio, comissão, volume mensal e taxa observada de incidentes. Até essa aprovação, o sistema não deve automatizar retirada de caixa nem concessão de goodwill.
- A política deve constar nos Termos de Uso do PRO quando afetar valores, prazo de repasse ou retenções.

Referências primárias:

- [Stripe — reservas em contas conectadas](https://docs.stripe.com/connect/connected-account-reserves)
- [Stripe — disputas em plataformas Connect](https://docs.stripe.com/connect/disputes)
- [Stripe — gestão de risco e responsabilidade](https://docs.stripe.com/connect/risk-management)

## Critérios obrigatórios para ativação futura

- Adaptador real executado somente no backend, sem credenciais privadas no frontend.
- Webhooks com assinatura criptográfica, idempotência e reconciliação transacional.
- Split, repasse após conclusão da aula, estorno parcial/total e chargeback testados em sandbox.
- Onboarding e verificação dos prestadores, responsabilidades operacionais e fluxo de suporte definidos.
- Comissão comercial da MAZZI e política financeira aprovadas pela diretoria.
- Checklist jurídico, LGPD, termos de uso e política de reembolso concluídos.
