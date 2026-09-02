# Plano Técnico — Fechamento E2E FCM no DEV

TASK: TASK-087  
STATUS: TECH_READY  
OWNER: MAZZI Tech Lead  
LAST_UPDATED: 2026-09-02

## Estratégia

Validar a cadeia já implementada sem reimplementar o FCM: evento canônico MAZZI → `notifications` no Supabase DEV → trigger de enqueue → `push_deliveries` → Edge Function `dispatch-push-notification` → FCM HTTP v1 → `public/sw.js` → navegação allowlisted no Student/PRO.

## Pré-condições

- Usar exclusivamente Supabase DEV `bhvpkgonhlujmxvwnxix` e Firebase DEV `mazzi-af65c`.
- Confirmar presença da VAPID pública no build, sem imprimir seu valor.
- Usar somente conta, dispositivo e reserva DEV controlados.
- Conceder manualmente a permissão de notificações no navegador/dispositivo controlado.
- Não criar `firebase-messaging-sw.js`; usar o `ServiceWorkerRegistration` do `public/sw.js`.

## Execução e evidências

1. Student: ativar notificações, confirmar um único device ativo em `user_push_devices` com contexto `STUDENT` e confirmar ausência de token em logs/relatórios.
2. Gerar uma confirmação real de reserva pelo fluxo MAZZI e conferir a notificação canônica e uma única entrega em `push_deliveries`.
3. Executar separadamente foreground, background/warm start, cold start e retomada pós-login; em cada caso registrar destino final, reserva exibida e ausência de duplicidade.
4. Abrir o mesmo item pelo Centro de Notificações e confirmar o mesmo destino do push.
5. Testar entidade inexistente/inacessível e registrar o fallback amigável.
6. Inspecionar o payload apenas por campos permitidos, sem registrar token completo, PII, endereço, valores financeiros ou conteúdo privado.
7. Repetir os cenários obrigatórios no Student DEV e PRO DEV publicados somente após os gates locais passarem. Se não houver fixture PRO segura, registrar `PRO_PUSH: NOT_TESTED` com motivo.

## Gates de saída

- `npm run lint`
- `npm test`
- `npm run build:all`
- `git diff --check`
- validação dos serviços DEV, migrations, Edge Function e origem HTTPS
- evidências `FOREGROUND: PASS`, `BACKGROUND: PASS`, `COLD_START: PASS`, `POST_LOGIN: PASS`, `NOTIFICATION_CENTER: PASS`, `FALLBACK: PASS`, `PUSH_PRIVACY: PASS` e `PRO_PUSH: PASS` ou `NOT_TESTED` justificado

Sem todas as evidências físicas, o status permanece bloqueado e não são executados deploy frontend, commit ou push. Production deve permanecer intocada.

`PRODUCTION_UNTOUCHED`
