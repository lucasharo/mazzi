# 26 — Ganhos do PRO e navegação de notificações

## Ganhos

O relatório do PRO chama exclusivamente `public.get_provider_earnings_summary`. A fonte financeira é `public.payouts`, em centavos inteiros; o navegador não lê `payouts` diretamente e não calcula split, taxa ou saldo.

- `net_earned_cents`: valor líquido dos payouts de aulas economicamente válidas;
- `received_cents`: somente `PAID`, pela data efetiva de recebimento;
- `to_receive_cents`: `PENDING`, `AVAILABLE` e `PROCESSING`;
- `blocked_cents`: somente `BLOCKED`;
- `failed_cents`: `FAILED`, separado como atenção;
- série diária: `net_earned_cents`, com cortes em `America/Sao_Paulo`;
- repasses futuros: `scheduled_release_at`, sem incluir bloqueados na previsão normal;
- avaliações: fonte real `reviews`; o limite é `COUNT(DISTINCT student_id) >= 30`.

Os períodos suportados são 7, 14 e 30 dias, com 30 dias inicialmente selecionado. Sem reviews reais, a tela mostra estado vazio e nunca uma nota artificial.

## Destino canônico

Notificações acionáveis usam um contrato fechado versionado, validado em `src/lib/notification-navigation.ts`:

| Evento | Contexto | Entidade | Ação | Fallback |
|---|---|---|---|---|
| `BOOKING_CONFIRMED`, cancelamento, check-in, contestação | Aluno/PRO | `booking` | `details` | Aulas |
| `NEW_MESSAGE` | Aluno/PRO | `booking` | `chat` | Aulas |
| Aula concluída elegível | Aluno | `booking` | `review` | Aulas |
| Compliance | PRO | `compliance` | `compliance` | Gestão |
| Payout pago/bloqueado/falho | PRO | `payout` | `details` | Ganhos |
| `REVIEW_RECEIVED` | PRO | `earnings` | `reviews` | Ganhos |

O contrato aceita somente contexto, entidade, ação e UUID allowlisted. Não aceita URL arbitrária. O hash existente evolui com query controlada (`v`, `c`, `e`, `a`, `id`) e continua compatível com `#/<app>/<tab>`.

O sino valida e marca a notificação como lida antes de fechar o modal e encaminhar. No cold start/refresh, o app lê o mesmo hash uma vez, valida a sessão e consulta a entidade usando as regras normais de RLS/RBAC. Um ID não concede acesso.

Destinos pendentes de sessão são guardados somente em `sessionStorage`, com TTL de 10 minutos e payload serializado/validado. Login falho preserva o destino para nova tentativa.

## PWA e push

`public/sw.js` permanece o único service worker. Os handlers `push` e `notificationclick` aceitam apenas payload mínimo com evento, contexto e destino validado; geram texto genérico sem mensagem privada, PII ou detalhes financeiros. O clique reutiliza uma janela do mesmo origin ou abre apenas o entrypoint atual com hash controlada.

Requests de Auth, Supabase, REST/RPC, Storage, API privada, cross-origin e métodos diferentes de GET continuam fora do cache.

O registro futuro de dispositivos usa `user_push_devices`, RLS deny-by-default e RPCs que derivam `auth.uid()`. Tokens/endpoint não são expostos por SELECT. O ciclo suporta múltiplos dispositivos, rotação e desativação.

O repositório não possui credenciais ou configuração DEV de FCM/Web Push. Por isso a capacidade e o estado da permissão são tratados sem bloquear o produto, mas a entrega push ponta a ponta (`BOOKING_CONFIRMED`) permanece **PENDENTE DE CONFIGURAÇÃO DO PROVEDOR**. Não foram criadas credenciais fictícias.

## Menu do PRO

A barra inferior canônica é `Início · Agenda · Aulas · Ganhos · Gestão`. Perfil não ocupa slot inferior; permanece acessível pelo ícone de conta no cabeçalho e pela área de conta em Gestão.

## Segurança e validação local

A migration `20260902040000_task_086_earnings_notifications_push.sql` é forward-only e local nesta task. Ela adiciona ação de navegação, registry protegido e RPC de detalhe de payout sem liberar SELECT em `payouts`.

Validações locais:

```text
npm run lint
npm test
npm run build:all
git diff --check
```

Nenhuma migration foi aplicada ao Supabase, nenhum secret foi criado e nenhum commit, push ou deploy foi feito nesta task.
