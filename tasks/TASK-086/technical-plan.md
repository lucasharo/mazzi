# Technical Plan — TASK-086

TASK: TASK-086
STATUS: TECH_READY
OWNER: MAZZI Tech Lead
LAST_UPDATED: 2026-09-02

## 1. Resumo técnico

Implementar a entrega em duas fatias coordenadas sobre a arquitetura existente:

1. Consolidar o relatório financeiro do PRO em uma RPC `SECURITY DEFINER` como única fonte de dados, mantendo `payouts` inacessível por `SELECT` direto no browser. A interface continuará sendo a responsável apenas por formatar centavos, estados e datas; não calculará split, taxa, comissão, saldo ou confirmação de pagamento.
2. Evoluir o router hash existente para uma localização tipada de segundo nível e fazer o sino, o pós-login, o cold start e o `notificationclick` passarem pelo mesmo resolvedor allowlisted. O push será uma entrega adicional da notificação in-app, sem criar histórico duplicado.

A primeira validação ponta a ponta de push será `BOOKING_CONFIRMED`. O repositório atualmente não contém Firebase/FCM, VAPID, Web Push, registro de dispositivos ou handler `notificationclick`. Portanto, o plano prepara contratos, RLS, ciclo de dispositivo e adaptador, mas não permite credenciais fictícias nem declara push real como homologado sem uma decisão de Product sobre o provedor e suas credenciais DEV.

O escopo não altera checkout, Stripe, split, política de cancelamento ou confirmação financeira. Nenhuma mutation remota, deploy, commit ou push faz parte desta TASK; a migration será criada localmente e somente aplicada após autorização específica.

## 2. Auditoria da implementação atual

### 2.1 Ganhos e desempenho

- `src/apps/provider/components/ProviderEarningsTab.tsx` já possui períodos `7 | 14 | 30`, inicia em 30, botão de atualização, estados de carregamento/erro/vazio e card de avaliações sem nota artificial.
- O componente chama `dbService.getProviderEarningsSummary`, portanto a direção arquitetural correta já existe. Contudo, o gráfico é intitulado “Evolução dos ganhos” e plota `lessons_completed`, não `net_earned_cents`; a alteração deve usar ganhos diários em centavos e manter uma leitura legível em 375/390/430 px.
- `UpcomingPayouts` recebe somente agregação por data (`date`, `amount_in_cents`, `payout_count`). Não recebe `payout_id`, status ou motivo canônico, impedindo diferenciação de `PENDING`, `AVAILABLE`, `PROCESSING` e navegação para um repasse.
- `src/lib/db-service.ts` já chama `public.get_provider_earnings_summary` sem enviar `provider_id`, e normaliza JSON numérico. Esse contrato deve ser mantido, porém com validação de shape/estado e novos campos opcionais compatíveis.
- `supabase/migrations/20260902020000_provider_earnings_performance.sql` já restringe o acesso por provider autorizado, usa `payouts`, `America/Sao_Paulo` e separa `PAID`, estados a receber, `BLOCKED` e `FAILED`. A revisão necessária é:
  - garantir que o `received_cents` use a data econômica de recebimento sem perder um payout liberado no período por ele ter sido ganho em outro período;
  - preservar o conceito de ganho líquido em centavos e deixar explícito o tratamento de `BLOCKED`/`FAILED`;
  - retornar série por `net_earned_cents`, não por quantidade de aulas;
  - retornar previsões com status e identificador somente dentro do escopo autorizado;
  - manter `scheduled_release_at` como fonte de previsão e excluir `BLOCKED` da previsão normal;
  - proteger o limite de período, o timezone e o contrato contra `NULL`, datas invertidas e respostas não tipadas.
- A RPC atual agrega avaliações por `provider_id` e conta `COUNT(DISTINCT student_id)`, o que atende a base do requisito. A implementação deve manter o progresso antes de 30, insights determinísticos após 30 e `NULL`/estado vazio quando não houver avaliações. A decisão sobre avaliações “do período” versus desempenho acumulado deve ser confirmada antes de alterar essa semântica; a recomendação técnica é manter o acumulado para o desbloqueio de desempenho e limitar por período apenas a parte financeira/série, documentando o comportamento.
- `ProviderAnalyticsPanel` e a analytics administrativa usam contratos diferentes e não devem ser reutilizados para o relatório financeiro do PRO; não misturar métricas de funil, `payments` ou analytics com `payouts`.

### 2.2 Navegação, notificações e autenticação

- `src/lib/mobile-app-router.ts` suporta apenas `#/<app>/<tab>` e não conhece entidade/ação. Deve ser estendido sem introduzir outro router.
- `NotificationsPanel` lista e marca notificações, mas não resolve destino, não fecha o modal, não navega e não diferencia notification acionável de histórico simples.
- `Notification` em `src/types/index.ts` não tem contrato de destino/ação nem metadata de navegação. A tabela `notifications` atualmente tem `app_context`, `entity_type` e `entity_id`, mas não uma ação validada.
- `20260826050000_task_077_pro_defaults_and_notification_context.sql` garante `app_context` e contexto por entidade, mas o trigger atual pode defaultar contexto para `PRO`; os novos caminhos não podem aceitar contexto fornecido pelo browser como autoridade. O contexto deve ser derivado/validado no backend e filtrado novamente pelo app.
- `ProviderApp` usa as rotas `dashboard`, `bookings`, `earnings`, `management`, `profile`; a rota `schedule` existe na tipagem, mas foi omitida de `ProviderBottomNav`. O quinto slot atualmente é `Perfil`, contrariando o contrato documentado em `docs/25-pro-earnings-performance.md`. O plano passa `Agenda` a ser slot real e mantém Perfil acessível por `Gestão > Conta/Perfil` ou ação de conta no header, sem excluir a funcionalidade.
- `StudentApp` e `ProviderApp` renderizam o painel de notificações por `appContext`, porém não têm fluxo compartilhado para booking detail/chat, payout, reviews ou compliance a partir de notificação.
- `AuthContext` hidrata a sessão, mas não possui armazenamento/consumo de destino pendente. O destino precisa sobreviver ao login sem guardar URL arbitrária, UUID não validado ou payload privado.
- `public/sw.js` tem política conservadora de cache e não escuta `push`/`notificationclick`. Deve continuar sendo o único service worker e nunca cachear Supabase, Auth, REST/RPC, Storage privado ou respostas privadas.
- `src/registerServiceWorker.ts` registra o worker único; o ciclo de push deve ser acoplado a esse registro, sem adicionar segundo worker ou segredo ao bundle.
- Busca no código e em `.env.example` não encontrou Firebase/FCM, VAPID, `PushManager`, `user_push_devices` ou `notificationclick`. A configuração do provedor é uma dependência externa pendente, não algo a ser simulado.

### 2.3 Banco e segurança existentes

- `payouts` possui centavos inteiros, status canônico, `scheduled_release_at`, `released_at`, `processed_at`, `failure_reason`, conta de destino e vínculo a `provider_id`/`booking_id`.
- A migration `20260828023332_pix_receiving_and_manual_payouts.sql` e o baseline mantêm `payouts_no_direct_client_select` como deny-by-default. Essa proteção não pode ser removida para alimentar a tela.
- Reviews têm `provider_id`, `instructor_id`, `student_id`, constraints de notas e RLS por `can_access_provider_reviews`. O resumo deve usar RPC segura para evitar que o front faça agregação arbitrária ou contorne vínculo.
- Notifications têm RLS de leitura/atualização do próprio usuário e grants limitados a `is_read`/`read_at`. A extensão de navegação deve manter esse princípio e tornar a ação imutável para o cliente.
- O projeto segue PostgreSQL/Supabase, RLS e RPCs `SECURITY DEFINER` com `search_path = public, pg_temp`; qualquer nova função precisa revogar `PUBLIC`/`anon` e conceder somente a operação necessária a `authenticated`.

## 3. Contrato tipado de navegação e resolução

Criar `src/lib/notification-navigation.ts` como módulo puro, sem dependência de React ou Supabase.

### 3.1 Tipos

Usar um contrato versionado e fechado:

```ts
type NotificationNavigationAppContext = 'STUDENT' | 'PRO' | 'ADMIN';
type NotificationNavigationEntity = 'booking' | 'payout' | 'earnings' | 'compliance';
type NotificationNavigationAction = 'details' | 'chat' | 'review' | 'reviews' | 'compliance';

interface NotificationNavigationTarget {
  version: 1;
  appContext: NotificationNavigationAppContext;
  entityType: NotificationNavigationEntity;
  entityId: string | null;
  action: NotificationNavigationAction;
}
```

O runtime validator deve:

- aceitar somente combinações da matriz de destino;
- exigir UUID v4/v7 válido para `booking`, `payout` e `compliance` quando a ação exigir entidade;
- aceitar `entityId: null` somente para seções (`earnings/reviews`), nunca para detalhe de reserva/repasse/documento;
- rejeitar versão, contexto, entidade, ação, chave ou tipo desconhecido;
- limitar tamanho e não interpretar URL, HTML, texto de notificação ou parâmetro livre como navegação;
- impedir `PRO` em `STUDENT`, `payout` fora de `PRO` e `compliance` fora de `PRO`;
- retornar um resultado explícito `INVALID_TARGET`/fallback, sem lançar mensagem técnica ao usuário.

### 3.2 Mapeamento canônico

| Evento | Target | Ação | Fallback |
|---|---|---|---|
| `BOOKING_CONFIRMED`, `BOOKING_CANCELLED`, check-in | `booking` + ID | `details` | Aulas |
| `NEW_MESSAGE` | `booking` + ID | `chat` | Aulas |
| Aula concluída elegível | `booking` + ID | `review` | Aulas |
| Contestação | `booking` + ID | `details` | Aulas |
| Compliance | `compliance` + ID | `compliance` | Gestão/Compliance |
| `PAYOUT_PAID`, `PAYOUT_BLOCKED`, `PAYOUT_FAILED` | `payout` + ID | `details` | Ganhos |
| `REVIEW_RECEIVED` | `earnings` | `reviews` | Ganhos |

`BOOKING_CONFIRMED` será a primeira origem de push validada ponta a ponta. O trigger/evento deve continuar idempotente (`ON CONFLICT DO NOTHING`/índice canônico) e não criar uma segunda row quando o push for enviado.

### 3.3 Router hash e ciclo de vida

Estender `src/lib/mobile-app-router.ts` com parser/serializer de query controlada na hash, preservando a API de troca de aba existente. Exemplo conceitual: `#/provider/bookings?target=...`, em que o valor é serializado por campos allowlisted e validado novamente ao ler.

Adicionar helpers de:

- `parseNotificationNavigationTarget` e `serializeNotificationNavigationTarget`;
- `navigateToNotificationTarget`, que primeiro valida o contexto e o destino e só então atualiza a hash;
- armazenamento temporário `sessionStorage` em `src/lib/pending-navigation.ts` para sessão expirada, com TTL curto, limpeza após consumo e somente o objeto tipado validado;
- fallback por contexto autorizado quando a entidade não existe, está expirada ou falha em RLS.

O target será consumido somente depois de `isAuthLoading === false`, usuário autenticado e dados mínimos do app carregados. A resolução de entidade continua fazendo consulta/RPC com a sessão atual; o UUID recebido nunca concede acesso.

No app aberto, `NotificationsPanel` deverá marcar a row como lida, fechar o modal e chamar o resolvedor. No cold start/refresh, os apps lerão a hash e executarão o mesmo resolvedor uma única vez. Em login interrompido ou falho, o target permanecerá pendente para nova tentativa, sem abrir a entidade.

## 4. Arquivos exatos previstos

### 4.1 Novos

- `[NEW]` `src/lib/notification-navigation.ts` — tipos, allowlist, validação, destinos e fallback.
- `[NEW]` `src/lib/pending-navigation.ts` — persistência curta e validada através do login.
- `[NEW]` `src/lib/push-device-registry.ts` — capability/permission state, registro, rotação, desativação e tratamento de suporte do browser; sem tokens expostos.
- `[NEW]` `src/components/notifications/NotificationNavigationBridge.tsx` — ponte opcional entre painel e callbacks do app, caso não seja possível manter a lógica no painel sem acoplamento.
- `[NEW]` `tests/notification-navigation.test.ts` — contrato, allowlist, IDs, contexto, ações e fallback.
- `[NEW]` `tests/notification-navigation-ui.test.tsx` — marcar como lida, fechar painel, navegação acionável e histórico sem destino.
- `[NEW]` `tests/push-device-registry.test.ts` — estados de permissão, suporte, rotação, logout e falhas sem bloqueio do app.
- `[NEW]` `tests/service-worker-notifications.test.ts` — inspeção/execução controlada de install, push, click, foco e cache.
- `[NEW]` `supabase/migrations/20260902040000_task_086_earnings_notifications_push.sql` — somente local nesta TASK; estrutura de destino, registry, RPCs e hardening do relatório.
- `[NEW]` `docs/26-pro-earnings-notification-navigation.md` — contratos, métricas, matriz de destinos, cold start, pós-login, push, segurança e DEV.

### 4.2 Modificados

- `[MODIFY]` `src/types/index.ts` — tipos fechados de notification target, estados de payout/upcoming e resposta financeira.
- `[MODIFY]` `src/lib/database.types.ts` — refletir colunas/RPCs locais quando o contrato de banco for alterado; não usar `any` como substituto.
- `[MODIFY]` `src/lib/mobile-app-router.ts` — segundo nível controlado na hash, sem router paralelo.
- `[MODIFY]` `src/lib/db-service.ts` — mapper validado, chamada da RPC financeira, detalhe de payout por RPC e registro/disable de dispositivo; sem `.from('payouts').select`.
- `[MODIFY]` `src/components/notifications/NotificationsPanel.tsx` — callback acionável, leitura, fechamento e resolvedor compartilhado.
- `[MODIFY]` `src/components/ui/NotificationIndicator.tsx` — preservar contador por `app_context` e invalidar após leitura/navegação.
- `[MODIFY]` `src/apps/provider/ProviderApp.tsx` — rota `schedule` real, consumo de targets de booking/chat/payout/reviews/compliance, fallback e acesso alternativo ao Perfil.
- `[MODIFY]` `src/apps/provider/components/ProviderBottomNav.tsx` — exatamente `Início`, `Agenda`, `Aulas`, `Ganhos`, `Gestão`; remover Perfil do slot inferior sem remover o recurso.
- `[MODIFY]` `src/apps/provider/components/ProviderEarningsTab.tsx` — ganhos por dia em centavos, status de repasse, estados vazios/erro, destaque de target e sem rating fake.
- `[MODIFY]` `src/apps/provider/components/ProviderDashboardTab.tsx` — resumo compacto de ganhos recentes, a receber, bloqueado e acesso a Ganhos.
- `[MODIFY]` `src/apps/provider/components/ProviderHeader.tsx` e/ou `src/components/ui/AppHomeHeader.tsx` — oferecer acesso claro à conta/Perfil sem reintroduzir Perfil como slot inferior.
- `[MODIFY]` `src/apps/provider/components/ProviderBookingDetailsModal.tsx` — abertura autorizada de detalhes e ação contextual sem confiar no target.
- `[MODIFY]` `src/apps/provider/components/ProviderAccountTab.tsx` e `src/apps/provider/components/ProviderManagementTab.tsx` — manter Perfil/Conta acessível no menu Gestão e preservar escola/CFC.
- `[MODIFY]` `src/apps/student/StudentApp.tsx` — resolver targets de aulas, chat e avaliação, preservar durante login e abrir fallback seguro.
- `[MODIFY]` `src/components/booking/BookingDetailsModal.tsx` e `src/components/chat/BookingChatPanel.tsx` — pontos de abertura idempotente de detalhe/chat.
- `[MODIFY]` `src/registerServiceWorker.ts` — registrar o worker único e inicializar capability/contexto, sem secret e sem segundo registro.
- `[MODIFY]` `public/sw.js` — handlers `push` e `notificationclick` com payload mínimo allowlisted, foco/reuso de cliente e proteção de cache existente.
- `[MODIFY]` `supabase/migrations/20260902020000_provider_earnings_performance.sql` somente se a implementação preferir corrigir a migration ainda não aplicada; caso contrário, aplicar `CREATE OR REPLACE`/constraints na migration nova e manter histórico imutável.
- `[MODIFY]` `tests/provider-earnings.test.ts`, `tests/mobile-app-router.test.tsx`, `tests/task-077-pro-defaults-context.test.ts`, `tests/database-schema.test.ts` — regressões dos contratos já existentes.
- `[MODIFY]` `docs/25-pro-earnings-performance.md` e `docs/CURRENT_IMPLEMENTATION_STATUS.md` — refletir o que realmente ficar implementado, sem marcar push/remote como pronto antes da validação.

## 5. Banco de dados, RLS e RPCs

### 5.1 Migration local

Criar `supabase/migrations/20260902040000_task_086_earnings_notifications_push.sql` somente após a aprovação deste plano. A migration deve ser forward-only, idempotente onde aplicável e não alterar dados remotos nesta etapa.

Componentes previstos:

1. **Destino de notificações**: adicionar coluna `navigation_action` ou um campo JSONB estritamente validado (a escolha deve manter o contrato versionado e evitar `metadata` livre). Para rows antigas, derivar ação somente de tipos conhecidos; valores desconhecidos permanecem sem ação e continuam como histórico.
2. **Constraints/índices**: check de ação/contexto compatíveis; índice por `user_id, app_context, is_read, created_at`; manter idempotência dos eventos existentes. Não usar `entity_id` como autorização.
3. **Registry**: criar `public.user_push_devices` com `id`, `user_id`, `app_context`, `provider`, token/endpoint protegido, fingerprint/hash para deduplicação, `last_seen_at`, `disabled_at`, `invalidated_at`, timestamps e `UNIQUE(user_id, app_context, fingerprint/hash)`. Se o provedor Web Push exigir endpoint/public key, armazenar cada parte necessária sob acesso exclusivo do backend.
4. **RLS do registry**: habilitar RLS; nenhum `SELECT`, `INSERT`, `UPDATE` ou `DELETE` direto por `anon`/`authenticated`. Expor apenas RPCs `SECURITY DEFINER` que derivem `auth.uid()`, validem contexto permitido e limitem a mutação ao próprio usuário. Tokens nunca retornam em listagem.
5. **RPC de registro**: `register_my_push_device(...)` deve validar provider/contexto, normalizar token, fazer upsert idempotente do próprio usuário, atualizar `last_seen_at` e reativar somente o token informado pelo próprio usuário.
6. **RPC de ciclo**: `disable_my_push_device(...)`, `rotate_my_push_device(...)`/upsert e invalidação server-side de token rejeitado. Logout chama desativação local/remota best-effort sem impedir logout; ausência de rede não mantém sessão aberta.
7. **RPC financeira**: evoluir `get_provider_earnings_summary(TIMESTAMPTZ, TIMESTAMPTZ)` para o contrato completo. A função deve derivar providers autorizados da sessão, validar provider/instrutor/escola internamente, usar centavos inteiros, timezone fixo e nunca aceitar `provider_id` arbitrário para ampliar escopo.
8. **RPC de detalhe**: criar `get_my_provider_payout_detail(UUID)` ou equivalente seguro para abrir o repasse. A função deve retornar somente campos mínimos, depois de verificar `auth.uid()`, role, permissão e vínculo ao provider; `payout_id` externo não é autorização.
9. **Reviews**: manter agregação na RPC segura; `COUNT(DISTINCT student_id)` deve ser a fonte do contador de 30. Para escola, o retorno deve conservar `provider_id`/`instructor_id` no desenho interno, mas não expor dados de instrutor não autorizado.
10. **Push de negócio**: o trigger/evento de `BOOKING_CONFIRMED` cria uma única row in-app e chama uma entrega assíncrona/adaptador backend somente quando houver device ativo. Falha de push não desfaz a notificação nem a confirmação da aula.

### 5.2 RLS/RBAC

- `payouts` continua deny-by-default para leitura do cliente. O front só chama RPCs autenticadas.
- `get_provider_earnings_summary` deve preservar `provider.finance.read_own` para instrutor próprio e `school.finance.read` para dono/staff ativo autorizado da escola. Staff sem permissão financeira não recebe dados.
- Para escola/CFC, a seleção é derivada do vínculo ativo e do provider de escola. Não aceitar `provider_id`, `instructor_id`, `payout_id` ou `booking_id` do push como prova de posse.
- Payout detail, booking detail, chat, compliance e reviews devem repetir a autorização existente/RLS do domínio. Falha de autorização e entidade inexistente usam o mesmo fallback para não criar oracle de existência.
- `notifications` continua filtrada por `user_id = auth.uid()` e `app_context`; `navigation_action` não pode ser alterada pelo cliente. A atualização permitida permanece restrita a `is_read`/`read_at`.
- RPCs `SECURITY DEFINER` devem fixar `search_path`, validar `auth.uid()`, revogar execução pública e fazer auditoria de mutações do registry e de qualquer alteração de destino/evento.
- Nenhum segredo Stripe, FCM service account, VAPID private key ou service-role key pode aparecer em `src`, `public`, `.env.example` com valor, logs ou payload.

## 6. Estratégia de implementação por fatias

### Fatia A — Contratos e domínio puro

1. Implementar tipos, allowlist, parser/serializer, UUID validation, matriz e fallbacks.
2. Adicionar testes puros para cada evento, ação inválida, UUID inválido, contexto incompatível, target nulo e payload malformado.
3. Estender o router hash mantendo compatibilidade com links existentes e sem mudar o checkout Stripe.

### Fatia B — RPC financeira e contrato de dados

1. Conferir tipos reais de `payouts`, estados, timestamps e relações escola/instrutor antes de escrever SQL.
2. Evoluir a RPC com métricas financeiras, série diária em `net_earned_cents`, próximos repasses por `scheduled_release_at` e reviews reais.
3. Adicionar RPC de detalhe de payout e mapear JSON com validação fail-closed.
4. Atualizar o painel do PRO e o card da Home. Period selector recalcula a consulta inteira; datas são cortadas em `America/Sao_Paulo`.
5. Reprovar qualquer implementação que leia payouts diretamente, calcule valor bruto/taxa no front ou mostre nota `5,0` sem reviews.

### Fatia C — PRO e perfil/navegação de tela

1. Corrigir bottom nav para os cinco slots canônicos, tornando `schedule` uma rota real; manter lógica existente de horários/bloqueios e não duplicar tela.
2. Tornar `ProviderApp` capaz de consumir target após workspace/booking data estar carregado: booking detail, chat, payout detail, reviews e compliance.
3. Tornar `StudentApp` capaz de consumir booking detail/chat/review; não abrir modal se a reserva não estiver na resposta autorizada.
4. Expor Perfil por header/Gestão Conta e cobrir navegação, back, refresh e target pendente.

### Fatia D — Sino, sessão e cold start

1. `NotificationsPanel` recebe callback de destino, marca leitura uma vez, fecha o modal e delega ao resolvedor.
2. O target validado vai para hash; se não autenticado, vai para `sessionStorage` com TTL e é removido somente após consumo autorizado.
3. Após login, consumir uma única vez; em erro de entidade, mostrar mensagem amigável e aba segura.
4. Garantir que app aberto não crie janela/modal duplicado e que refresh não volte prematuramente à Home.

### Fatia E — Registry, permissão e service worker

1. Implementar capability/permission state e CTA contextual “Ativar notificações”; recusa, browser sem suporte ou PWA restrita não bloqueiam o produto.
2. Integrar registro/rotação/desativação via RPC sem expor token. Uma identidade pode possuir múltiplos devices/contextos.
3. Adicionar `push`/`notificationclick` ao único `public/sw.js`: payload mínimo contém `version`, `eventType`, target allowlisted e `notificationId` opcional; nunca conteúdo privado completo.
4. No click, o worker deve tentar focar cliente existente da mesma origem/contexto, senão abrir o entrypoint permitido com target serializado. Não aceitar `data.url` arbitrária, `javascript:`, origem externa não allowlisted ou entidade privada no payload.
5. Implementar somente o adaptador aprovado para DEV. Sem FCM/Web Push/VAPID configurado, deixar a entrega desabilitada e documentar a dependência; não criar fake push nem secrets.

### Fatia F — Documentação e atualização de status

Atualizar `docs/25-pro-earnings-performance.md`, criar `docs/26-pro-earnings-notification-navigation.md` e atualizar `docs/CURRENT_IMPLEMENTATION_STATUS.md` com:

- fonte de cada métrica e semântica de cada status;
- regra dos 30 alunos únicos e insights determinísticos;
- matriz evento → contexto → entidade → ação → fallback;
- hash/cold start/PWA/pós-login;
- lifecycle de device/token e limites de privacidade;
- ausência ou presença real de FCM/Web Push no DEV;
- variáveis públicas permitidas e secrets obrigatórios somente no backend;
- como testar localmente sem mutação remota;
- status honesto (`PARCIAL`/`PENDENTE`) caso o provedor de push não esteja configurado.

## 7. Testes obrigatórios

### 7.1 Domínio e frontend

- `tests/notification-navigation.test.ts`: matriz completa, allowlist, UUID malformado, ação desconhecida, `app_context` incompatível, `entityId` nulo/indevido, target version, fallback e no-URL-arbitrary.
- `tests/mobile-app-router.test.tsx`: tabs legadas, query de target, back/forward, refresh, hash malformada, consumo único e ausência de loop.
- `tests/notification-navigation-ui.test.tsx`: sino marca lida, fecha painel, abre aba/ação correta, não navega duas vezes, histórico sem destino permanece histórico e erro não mostra UUID/stack.
- `tests/provider-earnings.test.ts`: períodos 7/14/30 com default 30, série de centavos, zero data, estados `PAID`/`PENDING`/`AVAILABLE`/`PROCESSING`/`BLOCKED`/`FAILED`, próximos 7 dias e ausência de rating fake.
- Teste de avaliações com 0, 29, 30 e múltiplos reviews do mesmo `student_id`; empates e dimensões nulas devem ser determinísticos.
- Testes de `ProviderApp`/`StudentApp` para target válido após loading, entidade inacessível, sessão expirada, pós-login, multi-role e fallback.
- Teste de Perfil acessível fora do bottom nav e de Agenda como quinto slot canônico do PRO.

### 7.2 SQL/RLS/RPC

- Extender `tests/database-schema.test.ts` para verificar função financeira, `SECURITY DEFINER`, `search_path`, grants, ausência de `SELECT payouts` no client, centavos e timezone.
- Adicionar assertions da migration TASK-086 para registry, RLS ativo, policies deny-by-default, RPCs de próprio usuário, unique token/fingerprint e constraints do destino.
- Testar finance RPC com instrutor próprio, instrutor de outro provider, school admin próprio, staff sem permissão, provider inexistente e IDs externos (IDOR).
- Testar payout detail com payout `PAID`, `BLOCKED`, `FAILED`, outro provider, booking cancelado/reembolsado e UUID malformado sem revelar existência.
- Testar `BOOKING_CONFIRMED` idempotente: uma row de notification por destinatário/evento e zero segunda row criada pelo push.
- Testar registry: múltiplos devices, mesmo token duplicado, rotação, token inválido, disable/logout, contextos diferentes e tentativa de ler token de terceiros.

### 7.3 Service worker

- Testar install/activate e limpeza do cache anterior.
- Testar que requests `POST`, Supabase/Auth/REST/RPC/Storage, origem externa e APIs privadas não entram no cache.
- Testar payload push válido mínimo, payload ausente/malformado e ausência de PII/conteúdo privado.
- Testar `notificationclick` focando cliente existente, abrindo uma única janela quando não existir e rejeitando URL arbitrária/contexto inválido.
- Testar atualização sem registrar segundo worker.

### 7.4 Portões finais

Executar, no workspace local e sem publicar:

```text
npm run lint
npm test
npm run build:all
git diff --check
```

Também executar testes de viewport mobile em 375, 390 e 430 px para Ganhos, Home do PRO, notificações e modais de destino. QA não poderá marcar AC19/AC20/AC21 como ponta a ponta enquanto o provedor de push e as credenciais DEV não estiverem aprovados e configurados.

## 8. O que não alterar

- Não alterar `src/apps/student/components/CheckoutModal.tsx`, `StripeHostedCheckout.tsx`, Edge Functions Stripe, webhook, split, taxas, reconciliação ou confirmação server-side.
- Não reativar Mercado Pago nem transformar o fake em gateway operacional.
- Não liberar `SELECT` direto em `payouts`, `provider_pix_destinations`, `payment_webhook_events` ou qualquer Storage privado.
- Não substituir `useMobileAppRoute` por React Router, Next Router ou outro router; não criar segundo service worker.
- Não confiar em `user_metadata`, `app_context`, `provider_id`, `payout_id`, `booking_id`, token ou URL enviados pelo cliente para autorização.
- Não alterar a regra canônica de cancelamento, double booking, horizonte de agenda, CPF/idade, RBAC geral, documentos privados ou integrações governamentais.
- Não introduzir LLM/IA, BI complexo, rating seed, números fictícios, fallback `5,0`, payload de push com PII ou dados financeiros detalhados.
- Não modificar migrations históricas destrutivamente nem aplicar migration no Supabase remoto nesta etapa.
- Não alterar `supabase/baseline-candidate` como atalho para schema.
- Não incluir credenciais, service accounts, VAPID private keys, FCM private keys, service-role keys ou passwords em código, docs ou `.env.example`.

## 9. Decisões pendentes e riscos

### Decisões que bloqueiam partes específicas

1. **Provedor de push DEV**: escolher FCM ou Web Push/VAPID e fornecer configuração pública necessária e secrets exclusivamente no backend. Até lá, registry/permission/SW podem ser implementados com entrega desabilitada, mas push E2E não pode ser declarado aprovado.
2. **Escopo da avaliação**: confirmar se a seleção 7/14/30 também corta reviews/contador de 30 ou se o desempenho é acumulado. Recomendação: financeiro/série no período; reviews e threshold acumulados.
3. **Fronteira do período**: confirmar inclusão do dia atual e instante final. Implementação recomendada: intervalo semiaberto `[from, to)` calculado em `America/Sao_Paulo`, com `to` no início do dia seguinte.
4. **Filtro de instrutor em CFC**: confirmar se a primeira entrega mostra filtro visual. O plano preserva `provider_id`/`instructor_id` e entrega visão consolidada sem inventar filtro adicional.
5. **Textos finais de push**: Product deve aprovar títulos/corpos mínimos por evento, sem mensagem privada, PII ou valor financeiro detalhado.

### Riscos e mitigação

- **Divergência financeira**: separar datas de ganho, recebimento e liberação no SQL e cobrir com fixtures de timezone/status.
- **IDOR por deep link**: RPC/RLS continuam autoridades; o target só seleciona uma tela e nunca retorna detalhes por si.
- **Perda pós-login**: armazenamento validado com TTL e consumo único; testes de login cancelado e sessão expirada.
- **Quebra de PWA**: modificar o único worker conservando cache denylist e testar atualização/fallback offline.
- **Duplicação de notificações**: manter índice/idempotência de negócio e tratar push como transporte, nunca como fonte de histórico.
- **Contexto multi-role incorreto**: device e target carregam `appContext`; contexto incompatível cai em fallback sem tentar interpretar outra aplicação.
- **Tokens expostos**: registry sem leitura direta, RPC de próprio usuário e entrega somente server-side.
- **Limite escolar**: sem decisão de filtro, não enviar dados por instrutor não autorizado; manter resposta consolidada do vínculo permitido.
- **Ambiente sem FCM/Web Push**: não simular sucesso; registrar dependência como `PENDENTE` e manter sino/in-app plenamente funcional.

## 10. Instruções diretas para MAZZI Dev

1. Executar as fatias na ordem A → B → C → D → E → F, mantendo cada mudança pequena e testável.
2. Ler o schema/migrations atuais antes do SQL e validar toda alteração localmente; não aplicar nada no Supabase DEV/produção nesta autorização.
3. Reutilizar o router, AuthContext, NotificationIndicator, RLS e RPCs existentes; não duplicar infraestrutura.
4. Implementar primeiro os testes do contrato e da segurança; fazer o front consumir somente o retorno validado da RPC.
5. Preservar a API existente de `useMobileAppRoute`, `NotificationsPanel` e `getProviderEarningsSummary` sempre que possível; se o contrato precisar mudar, adaptar todos os três entrypoints no mesmo patch.
6. Nenhum `any` novo para ocultar resposta RPC, nenhum `Number` usado para recalcular dinheiro e nenhuma URL recebida do backend/push usada sem allowlist.
7. Reportar no `implementation-report.md` quais ACs ficaram pendentes por decisão/provedor externo e incluir evidência dos portões `lint`, `test`, `build:all` e `diff --check`.
8. Encerrar a etapa local em `READY_FOR_COMMIT`/equivalente, sem commit, push, deploy ou mutation remota.
