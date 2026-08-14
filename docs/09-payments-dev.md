# MAZZI — pagamentos em desenvolvimento

## Regra

Durante desenvolvimento e testes, usar somente `FakePaymentProvider`. Ele não chama API externa, não coleta cartão real, não cria QR Pix real e nunca movimenta dinheiro.

## Comportamento do simulador

- Cria uma tentativa de pagamento vinculada a uma reserva em `payment_pending`.
- Retorna uma instrução de pagamento simulada e um identificador externo fictício.
- Permite cenários explícitos de aprovação, falha e expiração, por ação de desenvolvimento/teste.
- Confirmações passam pelo mesmo método idempotente que receberá webhooks do Mercado Pago.
- Reembolso simulado altera apenas os estados internos, preservando auditoria.

## Preparação para Mercado Pago

`PaymentProvider` será uma interface com operações para criar checkout, consultar evento, validar webhook e solicitar reembolso. `MercadoPagoPaymentProvider` só será ativado com credenciais de sandbox, conta configurada e decisões aprovadas sobre captura, split, repasse, estorno e chargeback.

## Segurança

- O modo fake só pode ser habilitado em ambiente `development` ou `test`.
- Produção deve falhar ao iniciar se o provedor fake estiver selecionado.
- Não colocar token, cartão, QR ou segredo em commits; manter valores em `.env`.
