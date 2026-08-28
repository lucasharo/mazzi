# QA Report — TASK-080

TASK: TASK-080  
STATUS: QA_APPROVED_WITH_CONFIGURATION_PREREQUISITE  
OWNER: MAZZI QA  
LAST_UPDATED: 2026-08-28

## Resultado

QA aprovado para merge/deploy de desenvolvimento. A confirmação automática via webhook depende da configuração operacional de `MERCADOPAGO_WEBHOOK_SECRET`; enquanto isso, a consulta manual autoritativa pelo checkout permanece disponível.

## Evidências

- Suíte automatizada: 808/808 testes aprovados.
- TypeScript: `npm run lint` aprovado.
- Builds: Student, Instructor e Admin aprovados.
- RLS habilitado nas três tabelas novas.
- RPC `get_admin_payouts()` executada remotamente com identidade Admin e retornou lista válida.
- Edge Functions Pix, webhook e cartão estão ativas no Supabase.
- Teste HTTP local do app Student: `HTTP 200`, documento com `lang="pt-BR"`, viewport configurado.

## Casos cobertos

- Gateway fake sem chamada ao Mercado Pago.
- Pix Mercado Pago pendente com QR/copia e cola.
- Expiração do Pix configurada 20 segundos antes do fim da reserva; no prazo padrão, são 9 minutos e 40 segundos.
- Consulta manual ao status autoritativo.
- Confirmação somente por RPC server-side aprovada.
- Idempotência de pagamento, webhook e repasse.
- Isolamento do destino Pix do PRO por ownership/RBAC/RLS.
- Bloqueio de repasse sem chave Pix.
- Teto combinado de taxas e valores inteiros em centavos.
- Estados de erro e carregamento no checkout e no repasse.

## Pendência operacional

Cadastrar `MERCADOPAGO_WEBHOOK_SECRET` nos secrets do Supabase e configurar a URL:

`https://bhvpkgonhlujmxvwnxix.supabase.co/functions/v1/mercadopago-payment-webhook`

Não foi executada cobrança real ou produtiva.
