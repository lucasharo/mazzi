# TASK-079 — Implementation report

## Entregue

- Configuração `VITE_PAYMENT_GATEWAY_PROVIDER=fake|mercadopago`, com fallback seguro para fake.
- Checkout fake preservado sem alteração de comportamento.
- Card Payment Brick oficial carregado sob demanda no modo Mercado Pago, em português, responsivo, uma parcela e com aviso explícito de ambiente de teste.
- Edge Function autenticada `process-mercadopago-card-payment`, com valor lido do banco, ownership, status, idempotência e confirmação somente para `approved`.
- RPC de finalização exclusiva de `service_role`, sem execução para `anon` ou `authenticated`.
- CI Cloudflare preparado para receber a variável de gateway e a chave pública por GitHub Variables/Secrets.
- Documentação financeira e decisão DEC-014 atualizadas.

## Supabase DEV

- Migration `task_079_mercadopago_test_checkout` aplicada no projeto `bhvpkgonhlujmxvwnxix`.
- Edge Function publicada com `verify_jwt=true`.
- Secret `MERCADOPAGO_ENVIRONMENT=test` configurado.
- `MERCADOPAGO_ACCESS_TOKEN` não foi configurado porque nenhuma credencial foi fornecida; assim, a função permanece fail-closed e não pode criar cobrança.

## Segurança

- PAN/CVV são tratados pelo Brick, não pelo MAZZI.
- O browser envia somente token e metadados permitidos.
- Valor e idempotency key são obtidos do payment persistido.
- Produção, PIX real, boleto, split e payout não foram ativados.
