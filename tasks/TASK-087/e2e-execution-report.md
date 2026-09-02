# Relatório de Execução — TASK-087 E2E FCM DEV

TASK: TASK-087  
STATUS: WAITING_MANUAL_DEVICE_E2E  
OWNER: MAZZI Dev  
LAST_UPDATED: 2026-09-02

## Ambiente

- Branch local: `feature/premium-ui-v2`.
- Frontend Student DEV: túnel HTTPS ativo e retornando HTTP 200.
- Frontend PRO DEV: túnel HTTPS ativo e retornando HTTP 200.
- Supabase DEV: projeto `mazzi-dev`, ref `bhvpkgonhlujmxvwnxix`.
- Firebase DEV: projeto `mazzi-af65c`.
- Navegador: Chrome controlado pelo `agent-browser`, sessão HTTPS Student.
- Production: nenhuma ação executada.

## Evidências obtidas

| Cenário | Resultado | Evidência |
|---|---|---|
| Student abre no túnel HTTPS | PASS | Rota `#/student/search` carregada sem overlay de erro. |
| Service Worker único | PASS | `sw.js` ativo no escopo do túnel; não há `firebase-messaging-sw.js`. |
| Sessão Student DEV | PASS | Conta Student DEV autenticada e tela Student carregada. |
| CTA explícito de notificações | PASS | Painel exibe “Ativar notificações”. |
| Permissão do navegador | PASS (dispositivo real) | O Student DEV registrou um token FCM ativo após a permissão concedida no Chrome/Android real; o contexto automatizado continua sem permissão observável. |
| Registro FCM no Supabase DEV | PASS | Device Student ativo, contexto/provider corretos e sem duplicação por fingerprint. |
| Evento `BOOKING_CONFIRMED` real | PASS | Reserva criada e paga no checkout Stripe DEV; reserva ficou `CONFIRMED`. |
| Dispatcher/FCM DEV | PASS | Dispatcher retornou `200`, com 3 envios aceitos pelo FCM e nenhuma falha/invalidação. |
| Reprocessamento controlado do evento mais recente | PASS | As três entregas pendentes do evento mais recente foram processadas uma única vez e ficaram `SENT`, sem erro ou invalidação. |
| Quality gates locais após a correção | PASS | `npm run lint`, `npm run test` (126 arquivos / 840 testes), `npm run build:all` e `git diff --check`. |
| Foreground/background/cold start/pós-login | NOT_EXECUTED | Dependem de um token real e de permissão em dispositivo controlado. |

## Reteste após correção

- O dispositivo Student DEV foi confirmado ativo em `user_push_devices`, com contexto `STUDENT`, provider `FCM` e uma linha ativa por fingerprint.
- Uma nova reserva foi criada pelo fluxo Student e paga pelo checkout Stripe de teste real; o pagamento ficou `PAID` e a reserva `CONFIRMED`.
- A notificação canônica `BOOKING_CONFIRMED` foi criada para a reserva e gerou três entregas para os devices ativos do Student.
- O dispatcher DEV retornou `200`, `sent=3`, `failed=0`, `invalidated=0`, `skipped=0`; as três linhas ficaram `SENT` com mensagem externa do projeto Firebase DEV.
- A causa corrigida foi a ausência de `SELECT` para `service_role` nas tabelas privadas consultadas pelo dispatcher. A migration `task_087_dispatcher_service_role_grants` foi aplicada somente no Supabase DEV.
- O evento mais recente foi reprocessado de forma controlada após a correção: as três entregas ficaram `SENT`, sem reenvio dos eventos antigos que poderiam gerar duplicidade.
- O caminho interno da Central de notificações foi ajustado para abrir o destino imediatamente; o deep link continua preservado para cold start e pós-login.
- Os quality gates locais foram repetidos após essa alteração e passaram.

## Conclusão

A cadeia backend → FCM está comprovada no DEV até `SENT`. O E2E completo ainda aguarda a confirmação no Chrome/Android real para foreground, background, cold start, pós-login, Centro de Notificações e fallback. Não houve envio artificial nem uso de dados de Production.

Para destravar, abrir o túnel Student em Chrome/Android controlado, entrar com o Student DEV, permitir notificações nas configurações do site e clicar novamente em “Ativar notificações”. Depois disso devem ser repetidos os cenários `BOOKING_CONFIRMED`, foreground, background, cold start e pós-login.

`PRODUCTION_UNTOUCHED`
