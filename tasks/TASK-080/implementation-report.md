# Implementation Report — TASK-080

TASK: TASK-080  
STATUS: READY_FOR_QA  
OWNER: MAZZI Dev  
LAST_UPDATED: 2026-08-28

## Implementado

- Pix Mercado Pago em ambiente de teste, alternável por `VITE_PAYMENT_GATEWAY_PROVIDER=fake|mercadopago`, com expiração externa 20 segundos antes do fim da reserva.
- QR Code e código copia e cola no checkout do Aluno, sem confirmação imediata da reserva.
- Consulta autoritativa manual no Mercado Pago pelo botão de atualização, além do webhook assinado.
- Finalização server-side idempotente, com validação do valor persistido em centavos, aluno, reserva e expiração.
- Webhook Mercado Pago sem JWT obrigatório, com HMAC, consulta ao gateway e deduplicação de eventos.
- Cadastro da chave Pix do próprio prestador no app PRO.
- Preparação de repasses de reservas pagas/concluídas no Admin, com taxas em centavos, teto combinado e destino mascarado.
- Registro manual do repasse pelo Admin com referência obrigatória, lock transacional e auditoria.
- Repasse sem destino Pix permanece `BLOCKED` até o Admin corrigir o cadastro.
- Mensagens de erro e estados de carregamento em português; o gateway fake foi preservado.

## Banco e deploy

- Migration `20260828023332_pix_receiving_and_manual_payouts.sql` aplicada no projeto Supabase `bhvpkgonhlujmxvwnxix`.
- Histórico da migration registrado como aplicada.
- RLS verificado em `provider_pix_destinations`, `payment_webhook_events` e `payouts`.
- RPCs remotas verificadas: finalização Pix, listagem de repasses e marcação de repasse manual.
- Edge Functions publicadas:
  - `process-mercadopago-pix-payment` (JWT).
  - `mercadopago-payment-webhook` (sem JWT, valida assinatura).
  - `process-mercadopago-card-payment` atualizado para registrar a taxa do gateway.

## Verificações

- `npm run lint`: aprovado.
- `npm run test`: aprovado — 115 arquivos e 808 testes.
- `npm run build:all`: aprovado para Student, Instructor e Admin.
- `git diff --check`: sem erro de whitespace; apenas avisos normais de conversão LF/CRLF do Git no Windows.
- A porta local do Student já estava ocupada; a página respondeu `HTTP 200` e serviu o HTML Vite. O CLI `agent-browser` não está instalado neste ambiente, então a inspeção visual automatizada não pôde ser executada.

## Configuração pendente antes do teste completo do webhook

Criar no painel do Mercado Pago o segredo de assinatura dos Webhooks e cadastrar no Supabase:

```bash
npx supabase secrets set MERCADOPAGO_WEBHOOK_SECRET="SEU_SEGREDO_DO_WEBHOOK" --project-ref bhvpkgonhlujmxvwnxix
```

O Access Token e `MERCADOPAGO_ENVIRONMENT=test` já estão configurados. Nenhum segredo foi incluído no repositório.

## Limitação conhecida

`supabase db lint --linked --fail-on error` ainda reporta erros preexistentes de PostGIS, funções legadas de lock, enum `OWNER` e `availability_exceptions.updated_at`. Nenhum dos apontamentos é originado pelas tabelas ou RPCs desta tarefa.
