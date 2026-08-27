# Technical Plan — TASK-079

TASK: TASK-079
STATUS: TECH_READY
OWNER: MAZZI Tech Lead
LAST_UPDATED: 2026-08-27

## Resumo Técnico

O checkout resolverá o modo visual por `VITE_PAYMENT_GATEWAY_PROVIDER`. O fake permanecerá intacto. O modo Mercado Pago carregará o SDK React oficial e o `CardPayment` Brick somente quando selecionado. O callback enviará o token à Edge Function `process-mercadopago-card-payment`, que validará o JWT, consultará booking/payment no Supabase, usará o valor persistido em centavos, chamará `/v1/payments` com `X-Idempotency-Key` e finalizará a transação apenas para `approved`.

## Arquivos Afetados

- [MODIFY] `.env.example`
- [MODIFY] `package.json` e lockfile
- [MODIFY] `src/apps/student/components/CheckoutModal.tsx`
- [NEW] `src/apps/student/components/MercadoPagoCardCheckout.tsx`
- [NEW] `src/lib/payment-gateway-config.ts`
- [MODIFY] `src/lib/db-service.ts`
- [NEW] `supabase/functions/process-mercadopago-card-payment/index.ts`
- [MODIFY] `supabase/config.toml`
- [NEW/MODIFY] testes de configuração, checkout e contrato da Edge Function
- [MODIFY] documentação financeira, decisões e status de implementação

## Banco de Dados & Segurança

Não será criada migration: as RPCs transacionais existentes continuam sendo a autoridade de criação e confirmação. A Edge Function usa JWT obrigatório, valida `auth.getUser`, verifica ownership por `student_id`, cruza payment/booking e usa service role somente no servidor para a finalização já protegida. O Access Token nunca é retornado nem versionado.

## Estratégia de Implementação

1. Criar resolver tipado/fail-safe para o modo de checkout.
2. Adicionar SDK oficial e componente isolado do Brick, com idioma pt-BR, uma parcela e loading/erro acessíveis.
3. Adicionar invocação tipada no `dbService`.
4. Implementar Edge Function com CORS restrito, JWT, validações, idempotência e ambiente de teste obrigatório.
5. Compor o checkout sem alterar o fluxo fake.
6. Atualizar documentação e decisão de produto, deixando explícito que produção permanece desabilitada.

## Testes Obrigatórios

- Resolver aceita apenas `fake|mercadopago` e usa fake por padrão.
- Fake continua exibindo PIX/cartão simulados.
- Mercado Pago não exibe PIX, exige chave pública e envia somente payload tokenizado.
- Edge Function rejeita método, ambiente, autenticação, ownership e valores inválidos.
- Status não aprovado não confirma reserva; aprovado finaliza uma vez.
- Viewport mobile sem overflow; controles com loading/disabled.
- `npm run lint`, `npm test`, `npm run build:all` e `git diff --check`.

## Riscos e Mitigações

- **Cobrança real acidental:** função exige `MERCADOPAGO_ENVIRONMENT=test`; credenciais não são incluídas no repositório.
- **Duplicidade:** chave do payment/attempt é usada como idempotency key no Mercado Pago.
- **Manipulação do valor:** função ignora valor enviado pelo cliente e usa `payments.amount_in_cents`.
- **SDK de terceiros:** carregamento fica isolado no modo Mercado Pago e com estado de erro amigável.

## O que NÃO Alterar

Produção, `main`, PIX real, boleto, split/payout, OAuth de vendedor, regras de preço ou confirmação pelo frontend.

## Orientação de UI

A skill `ui-ux-pro-max` orientou formulário com labels visíveis, erro próximo, botão desabilitado/loading, touch target mínimo e layout mobile-first. A busca automatizada da skill não pôde ser executada porque o Python disponível é 2.7; foram aplicadas as regras de referência integralmente lidas.
