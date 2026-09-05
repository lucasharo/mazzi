# Technical Plan — TASK-091

TASK: TASK-091
STATUS: TECH_READY
OWNER: MAZZI Tech Lead
LAST_UPDATED: 2026-09-04

## 1. Resumo Técnico

Aplicar uma migration incremental de consolidação no Supabase DEV para
republicar as RPCs corrigidas sem editar migrations históricas. No frontend,
manter o status vindo do banco, criar um derivador puro de estado operacional,
remover fallback local e ajustar os consumidores para consultar esse estado.

## 2. Código Existente Relacionado

- `src/lib/db-service.ts`: mapper de booking, RPCs e carregamento de bookings.
- `src/domain/booking.ts`, `src/domain/checkin.ts` e
  `src/domain/instant-lesson.ts`: lifecycle, check-in e regras puras.
- `ProviderApp`, `ProviderBookingDetailsModal` e componentes instantâneos:
  banner, modal, tracking e navegação.
- `BookingDetailsModal`/`StudentApp`: Hoje, Histórico e mapa do aluno.
- `external-navigation-service.ts`, `meeting-point.ts` e `UniversalMap`.

## 3. Arquivos Provavelmente Afetados

- `[NEW]` `tasks/TASK-091/*`
- `[NEW]` migration forward-only de consolidação Aula Agora.
- `[MODIFY]` `src/types/index.ts`, `src/lib/database.types.ts` se necessário.
- `[MODIFY]` `src/domain/booking.ts`, `src/domain/checkin.ts`,
  `src/domain/instant-lesson.ts`, `src/domain/status-presentation.ts`.
- `[MODIFY]` `src/lib/db-service.ts`, `src/lib/error-mapper.ts`.
- `[MODIFY]` `src/apps/provider/ProviderApp.tsx`, modais/banner instantâneos,
  `src/apps/student/components/BookingDetailsModal.tsx`.
- `[NEW/MODIFY]` testes unitários, contrato SQL e regressão.

## 4. Banco de Dados & Migrations

Republicar com `SECURITY DEFINER`, `search_path` fixo e grants somente para
authenticated: `user_has_role`, create/price/dispatch, leitura de bookings do
PRO com redaction por status e `set_provider_on_the_way`. Adicionar o tipo
semântico `PROVIDER_ON_THE_WAY` ao contrato de notifications, usar `NOT EXISTS`
para idempotência e registrar `audit_logs` sem coordenadas. O ponto de leitura
do PRO deve devolver `meeting_point` aproximado quando Aula Agora estiver em
`PENDING_PAYMENT` e o objeto original em `CONFIRMED`.

## 5. RLS e RBAC Afetados

RLS das tabelas permanece ativo. RPCs devem validar `auth.uid()`, role Student
por `user_has_role`, participante do booking e instrutor atribuído. Nenhuma
role de owner ou escola pode declarar movimento físico em nome do instrutor.

## 6. Estratégia de Implementação

1. Remover `ON_THE_WAY` dos tipos/listas de status comercial.
2. Adicionar derivação pura e trocar consumidores para usar timestamp/check-in.
3. Preservar ponto estruturado e eliminar coordenada fake/fallback browser.
4. Corrigir carregamento do PRO via RPC redacted, inclusive autoescola.
5. Criar migration forward-only com funções e grants corrigidos.
6. Adicionar testes adversariais e atualizar contratos antigos que modelavam
   deslocamento como status de booking.
7. Rodar lint/test/build/diff check e só então aplicar no DEV.
8. Auditar schema/ledger live, advisors e smoke controlado sem Production.

## 7. Testes Obrigatórios

Mapper preserva `CONFIRMED`; derivação de `CONFIRMED + timestamp`, check-in e
`IN_PROGRESS`; Hoje versus Histórico; ausência do fallback; autorização por
instrutor/owner/escola; retry idempotente; redaction antes/depois do pagamento;
coordenadas inválidas; URL de navegação; multi-role; preço distinto; onda 3;
janela de agenda; suite completa e quatro builds.

## 8. O que NÃO Alterar

Production, migrations aplicadas historicamente, checkout Stripe/webhook,
cancelamento tradicional, payout, contratos de categoria B pública, OSM/Leaflet,
componentes visuais aprovados e a modificação local de `SlotSelectorModal`.

## 9. Instruções para o MAZZI Dev

Não usar `git add .`, reset, clean, restore ou force push. Não usar floats para
dinheiro, `service_role` no browser ou coordenadas aproximadas como destino.
Falha de RPC deve chegar à UI sem mutação local. Não declarar READY_FOR_RELEASE;
isso depende de QA e revisão final com evidência do DEV.
