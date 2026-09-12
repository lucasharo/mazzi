# Stripe Connect: Transfer, saldo e payout bancário

O repasse do PRO possui duas operações Stripe distintas. A MAZZI cria somente a
Transfer para a Connected Account; o Stripe cria o payout bancário conforme o
schedule automático da conta.

```text
scheduled_release_at (regra MAZZI)
    ↓
Transfer tr_... para a Connected Account
    ↓
saldo pending da Connected Account
    ↓
BalanceTransaction.available_on → payouts.stripe_available_on
    ↓
saldo available
    ↓
payout automático po_...
    ↓
payout.created / payout.updated
    ↓
payout.paid ou payout.failed
```

`scheduled_release_at` não é `stripe_available_on`, e nenhum deles é
`stripe_arrival_date`. O primeiro libera a operação interna da MAZZI; o segundo
é a disponibilidade do crédito no saldo Stripe; o último é a previsão de
chegada bancária do objeto `po_...`.

Após criar `tr_...`, `process-automatic-stripe-payouts` consulta a lista de
Balance Transactions no contexto da Connected Account (`Stripe-Account:
acct_...`) e procura a transação cujo `source` é a Transfer. A consulta é
retentável e uma falha não desfaz nem repete a Transfer. O cron também
reconcilia registros legados que já possuem `transfer_reference`.

O webhook valida `event.account`, lista as Balance Transactions do `po_...`
na mesma Connected Account e relaciona o payout MAZZI pela origem `tr_...`.
Valor, data ou provider isoladamente nunca são usados para escolher um
registro. Eventos repetidos e fora de ordem são aceitos de forma idempotente;
`payout.paid` grava `stripe_paid_at` e somente então o status bancário é
concluído. Falhas registram código/mensagem e não criam nova Transfer.

Não há `POST /v1/payouts` no fluxo brasileiro. O único POST financeiro deste
processador é `POST /v1/transfers`, com a mesma chave de idempotência do payout
MAZZI.
