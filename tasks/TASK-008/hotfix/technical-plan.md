# TASK-008-HOTFIX — Plano Técnico

TASK: TASK-008-HOTFIX
STATUS: TECH_READY
OWNER: MAZZI Tech Lead
LAST_UPDATED: 2026-08-18

## Resumo Técnico

O INSERT de public.quotes na migration 40 omite três colunas NOT NULL.
A idempotência atômica da migration 38/39 (ON CONFLICT DO NOTHING) foi substituída por TOCTOU.
Um script e um teste executam DDL diretamente no Supabase LIVE.

## Código Existente Relacionado

- migration 38: arquitetura atômica (ON CONFLICT) com todos os campos
- migration 39: validações completas (provider, instructor, vehicle, slot)
- migration 40: versão quebrada (INSERT incompleto, TOCTOU, resposta incompleta)
- rpc-cancellation-v2-real.test.ts: beforeAll aplica migration SQL no LIVE
- apply-migration-40-and-validate.ts: aplica migration 40 diretamente no LIVE

## Arquivos Afetados

[MODIFY] supabase/migrations/20260818000040_restore_slot_contract_and_readonly_availability.sql
[MODIFY] tests/rpc-cancellation-v2-real.test.ts
[MODIFY] scripts/apply-migration-40-and-validate.ts  (adicionar aviso/guard)
[NEW]    tests/quote-null-columns-hotfix.test.ts
[MODIFY] tests/task-008-scheduling-and-ui.test.ts    (adicionar asserções)

## Estratégia de Implementação

### 1. Corrigir migration 40 — create_quote_from_offering

Substituir a funcao deficiente pela versao completa da migration 38/39 + correcoes:
- Manter housekeeping write-path (UPDATE bookings EXPIRED) no topo
- Manter verificacao precoce de idempotencia (fast path)
- Garantir INSERT com provider_id, instructor_id, vehicle_id
- Garantir ON CONFLICT (student_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
- Retornar todos os 14 campos no JSON

### 2. Neutralizar DDL em rpc-cancellation-v2-real.test.ts

O beforeAll aplica migration 37 via pgClient.query(sql37).
Adicionar guarda: skip se variavel de ambiente MAZZI_LIVE_DDL_TESTS !== 'true'
O bloco de aplicacao de DDL deve ser completamente ignorado em npm test normal.

### 3. Adicionar aviso em apply-migration-40-and-validate.ts

Adicionar verificacao no topo: se nao houver variavel MAZZI_ALLOW_LIVE_MIGRATION=true, abort com mensagem clara.

### 4. Expandir tests/task-008-scheduling-and-ui.test.ts

Adicionar assertes que verificam:
- INSERT com as 3 colunas
- ON CONFLICT present
- is_idempotent presente na resposta
- student_id, provider_id etc na resposta

### 5. Criar tests/quote-null-columns-hotfix.test.ts

Testes locais (file system, sem DB real) que verificam o SQL da migration 40.

## Testes Obrigatorios

- npm run lint — 0 erros
- npm test — 100% aprovado
- npm run build:all — builds integros
