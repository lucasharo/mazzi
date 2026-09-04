# Technical Plan — TASK-089

TASK: TASK-089
STATUS: TECH_READY
OWNER: MAZZI Tech Lead
LAST_UPDATED: 2026-09-03

## 1. Resumo técnico

Implementar Aula Agora como uma extensão do domínio atual de ofertas, disponibilidade, bookings, mapa, geolocation, notificações e pagamentos. O frontend chamará apenas RPCs/serviços já encapsulados por `dbService`; nenhuma nova tabela será lida diretamente pelo browser. O backend será a autoridade para elegibilidade, preço snapshot, agenda, privacidade, expiração e concorrência.

## 2. Código existente auditado e reutilizado

- `src/apps/student/StudentApp.tsx`: shell, busca, localização, mapa, bookings, toasts e navegação.
- `src/apps/provider/ProviderApp.tsx` e `ProviderManagementTab.tsx`: workspace, Gestão, refresh, loading, toggles/abas e ações do prestador.
- `src/components/maps/UniversalMap.tsx`, `MazziMap.tsx`, `LeafletMap.tsx` e `MapView.tsx`: primitive Leaflet/OSM e localização protegida.
- `src/components/search/AddressAutocomplete.tsx`/`ConfirmableAddressAutocomplete.tsx`: endereço Geoapify.
- `src/components/ui/Button.tsx`, `Input.tsx`, `Select.tsx`, `Badge.tsx`, `Modal.tsx`, `EmptyState.tsx`, `ContentSkeleton.tsx`, `Toast.tsx` e `AppPageHeader.tsx`.
- `src/domain/availability.ts`, `search.ts`, `booking.ts`, `money.ts`, `date-format.ts` e `lesson-session.ts`.
- `src/lib/db-service.ts`, `supabase.ts`, `firebase-messaging.ts`, `notification-navigation.ts` e o canal realtime existente.

## 3. Arquivos afetados previstos

- `[NEW]` `supabase/migrations/20260904011639_task_089_instant_lesson.sql`
- `[NEW]` `src/domain/instant-lesson.ts`
- `[NEW]` `src/components/instant/InstantLessonPriceSelector.tsx`
- `[NEW]` `src/components/instant/InstantLessonOfferCard.tsx`
- `[NEW]` `src/components/instant/InstantLessonStatusCard.tsx`
- `[NEW]` `src/components/instant/InstantLessonTrackingCard.tsx`
- `[NEW]` `src/apps/student/components/InstantLessonModal.tsx`
- `[NEW]` `src/apps/provider/components/ProviderInstantLessonPanel.tsx`
- `[MODIFY]` `src/types/index.ts`
- `[MODIFY]` `src/lib/db-service.ts`
- `[MODIFY]` `src/apps/student/StudentApp.tsx`
- `[MODIFY]` `src/apps/provider/ProviderApp.tsx`
- `[MODIFY]` `src/apps/provider/components/ProviderManagementTab.tsx`
- `[MODIFY]` `src/lib/notification-navigation.ts`
- `[NEW]` `tests/instant-lesson-domain.test.ts`
- `[NEW]` `tests/instant-lesson-contract.test.ts`
- `[NEW]` `tests/instant-lesson-ui.test.tsx`
- `[NEW]` `tasks/TASK-089/implementation-report.md`, `qa-report.md`, `final-review.md`

Os arquivos já modificados por tasks anteriores serão tocados apenas quando a integração exigir; alterações sem relação não serão revertidas.

## 4. Banco de dados e migration

Criar somente o mínimo necessário:

1. `provider_instant_settings`: uma linha por `provider_id + offering_id`, com `instant_enabled`, `instant_online`, `instant_price_in_cents`, `max_distance_km`, timestamps e constraints de centavos/raio.
2. `instant_lesson_requests`: aluno, ponto de encontro privado, categoria, transmissão, teto em centavos, status, expiração, chave de idempotência, vencedor e booking.
3. `instant_lesson_offers`: request, provider/offering/instructor/vehicle, preço snapshot, distância/ETA, expiração, status e idempotência; índice único para uma oferta ativa por recurso e request.
4. `instant_provider_locations`: somente o último estado operacional, timestamp e coordenada; sem histórico permanente.

RPCs SECURITY DEFINER com `search_path` fixo e grants mínimos:

- `get_my_instant_settings`, `save_my_instant_setting`, `set_my_instant_online`;
- `upsert_my_instant_location`, `get_my_instant_offers`, `respond_to_instant_offer`;
- `get_instant_price_options`, `create_instant_lesson_request`, `get_my_active_instant_request`, `cancel_instant_lesson_request`;
- `get_instant_request_state` e `get_instant_tracking` com retorno sanitizado por participante.

O dispatch será uma função backend/RPC transacional que filtra PostGIS, offering/veículo/compliance/agenda/localização, aplica ETA conservador, fairness simples e cria no máximo três offers por onda. O aceite usará lock/UPDATE condicional e criará o `quotes`/`bookings` normal com preço snapshot e a mesma política de fee vigente. Não haverá nova tabela financeira nem chamada de gateway.

As novas tabelas terão RLS habilitado sem `USING (true)`: aluno somente suas requests e tracking do vencedor; PRO somente settings, localização própria e offers direcionadas; anon sem SELECT. A exposição pública pré-match será somente agregada/sanitizada.

## 5. Contrato de domínio

Centralizar em `src/domain/instant-lesson.ts` as constantes `INSTANT_LESSON_MAX_ARRIVAL_MINUTES = 30`, `INSTANT_LESSON_SAFETY_MARGIN_MINUTES = 15`, `INSTANT_MATCH_WAVE_SIZE = 3`, `INSTANT_OFFER_TIMEOUT_SECONDS = 15`, freshness e cadências. O módulo será puro e testará preço como gate, ranking sem preço primário, distância conservadora, conflito dinâmico, self-match, buckets de teto e estados.

## 6. Estratégia de UI

Student terá CTA Aula Agora no shell de busca e modal mobile-first com localização confirmada, category/transmission, teto derivado e estados de busca/cancelamento. O mapa será o primitive existente com overlays protegidos, sem escolha individual de PRO.

PRO terá uma seção/aba de Gestão para preço, raio, toggle online, status de localização e offers. O card de offer será compartilhado com countdown, preço, ETA, distância, duração e ações. Todas as ações terão loading/disabled/error e targets mínimos de 44px, usando tokens e primitives MAZZI existentes.

## 7. Realtime e localização

Usar o canal realtime existente e RPCs sanitizadas. PRO envia somente latest location em 20–30 s ou mudança relevante; Student recebe tracking do vencedor em 5–10 s após o match. Se realtime cair, recuperar o estado por RPC sem criar request/offer duplicada. Localização stale não entra em nova elegibilidade.

## 8. Testes obrigatórios

- Domínio: buckets, preço livre, ranking/ETA, travel-duration-travel-margin, freshness e estados.
- Contrato SQL: tabelas/RLS/grants/constraints/RPCs, snapshot e ausência de acesso anon.
- Concorrência: duas respostas aceitas simultaneamente geram um único winner/booking.
- Segurança: cruzamento student/request, PRO/offer, localização antes/depois do match e self-match.
- UI: jornada Student, configuração/offer PRO, loading/error/expired, acessibilidade e 375/390/430 px sem overflow.
- Regressão: agendamento tradicional, booking/payment existentes, builds dos quatro targets.

## 9. O que não alterar

- Migrations históricas, Production, Supabase PRD, checkout Stripe e política financeira atual.
- Contratos de cancelamento, review, notificações e booking lifecycle, exceto extensões mínimas de `source`/metadata aprovadas pela migration.
- Busca tradicional e seu comportamento de preço/ordenamento.
- Auth/RBAC global e componentes existentes sem necessidade demonstrada.

## 10. Ordem de implementação

1. Adicionar domínio/tipos e testes puros.
2. Criar migration incremental e testes de contrato.
3. Encapsular RPCs no `dbService`.
4. Integrar seção Student e seção PRO com componentes compartilhados.
5. Executar lint, testes, build e diff check; corrigir regressões.
6. Aplicar migration somente no Supabase DEV depois da revisão local e dos gates.
7. Revalidar DEV publicado, CI e Database Baseline Verify; somente então commit/push/deploy DEV.

## 11. Instruções ao Dev

Não usar acesso direto a tabelas novas no frontend, `service_role`, floats, alertas nativos, coordenadas exatas pré-match ou números mágicos fora do domínio. Não declarar a task pronta antes de registrar os artefatos, executar os gates e entregar evidência de que Production e dinheiro real não foram tocados.
