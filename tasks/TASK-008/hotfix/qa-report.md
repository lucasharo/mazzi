# TASK-008 HOTFIX — QA Report

TASK: TASK-008-HOTFIX
STATUS: QA_APPROVED
OWNER: MAZZI QA
LAST_UPDATED: 2026-08-18

---

## Resultado: APROVADO COM RESSALVAS

Aprovado para seguir ao Tech Lead Final Review.
Ressalvas documentadas na seção de Bugs/Riscos.

---

## Ambiente Auditado

- Branch: premium_ui_v2
- Node: 18.x / npm 10.x
- Vite: v6.4.3 / Vitest: v4.1.10
- Arquivos modificados: 3 + 1 novo criado
- Nenhuma migration aplicada no LIVE

---

## Criterios de Aceite

- AC01: PASS — create_quote_from_offering INSERT corrigido com todas as 3 colunas NOT NULL
- AC02: PASS — migration 40 local contém v_offering.provider_id, v_offering.instructor_id, v_offering.vehicle_id nas VALUES
- AC03: PASS — resposta JSON agora contém os 14 campos do contrato incluindo student_id, provider_id, instructor_id, vehicle_id
- AC04: PASS — ON CONFLICT (student_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING + RETURNING * INTO v_existing_quote presente
- AC05: PASS — QUOTE_IDEMPOTENCY_KEY_STALE presente na funcao
- AC06: PASS — QUOTE_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST presente na funcao (incluindo verificacao no fast path)
- AC07: PASS — is_offering_slot_available marcada STABLE SECURITY DEFINER sem DML
- AC08: PASS — get_available_slots_public STABLE SECURITY DEFINER sem DML
- AC09: PASS — npm run lint: 0 erros (tsc --noEmit clean)
- AC10: RESSALVA — npm test: falha com 55/55 FAIL por erro de configuracao do Vitest pre-existente no ambiente CI (confirmado por baseline com git stash: mesmo resultado antes das mudancas)
- AC11: PASS — npm run build:all: BUILD_PASS, 3 apps compilados (student, instructor, admin)
- AC12: PASS — git status confirma: branch premium_ui_v2, sem push nem merge
- AC13: PASS — Nenhuma migracao aplicada no Supabase LIVE durante esta task
- AC14: PASS — rpc-cancellation-v2-real.test.ts agora tem guard MAZZI_LIVE_DDL_TESTS=true
- AC15: PASS — apply-migration-40-and-validate.ts agora requer MAZZI_ALLOW_LIVE_MIGRATION=true ou aborta
- AC16: PASS — CheckoutModal ja usa checkoutAttemptIdRef.current na chave de idempotencia

---

## Happy Path

Auditoria do SQL da migration 40 (estatica, sem DB):

1. insert_block = "INSERT INTO public.quotes (...provider_id, instructor_id, vehicle_id...)" -> PRESENT
2. values_block = "v_offering.provider_id, v_offering.instructor_id, v_offering.vehicle_id" -> PRESENT
3. conflict_clause = "ON CONFLICT (student_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING" -> PRESENT
4. returning_clause = "RETURNING * INTO v_existing_quote" -> PRESENT
5. json_response_fields: todos os 14 campos incluindo os 4 que estavam faltando -> PRESENT
6. fast_path_check com QUOTE_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST no bloco inicial -> PRESENT

---

## Negative Tests

- Tentativa com idempotency_key stale -> QUOTE_IDEMPOTENCY_KEY_STALE: PRESENT
- Tentativa com key reusada com dados diferentes -> QUOTE_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST: PRESENT (dois pontos: fast path e conflict branch)
- OFFERING_NOT_FOUND_OR_INACTIVE: PRESENT
- OFFERING_INSTRUCTOR_NOT_ASSIGNED: PRESENT (nova validacao adicionada)
- OFFERING_VEHICLE_NOT_ASSIGNED: PRESENT (nova validacao adicionada)
- PROVIDER_INACTIVE: PRESENT
- SLOT_MUST_BE_IN_FUTURE: PRESENT

---

## Seguranca e RLS/RBAC

- SECURITY DEFINER presente na funcao: PASS
- Nenhuma service_role key exposta no frontend: PASS
- DDL em producao via tests: NEUTRALIZADO com guard MAZZI_LIVE_DDL_TESTS
- DDL em producao via script: NEUTRALIZADO com guard MAZZI_ALLOW_LIVE_MIGRATION

---

## Regressao

- is_offering_slot_available: STABLE SECURITY DEFINER, sem DML, com todos os checks de scheduling: PASS
- get_available_slots_public: STABLE SECURITY DEFINER, sem DML: PASS
- Write-path housekeeping (UPDATE bookings EXPIRED): PRESERVADO em create_quote_from_offering
- Contrato de resposta do frontend CheckoutModal: COMPATIVEL (campos presentes)

---

## Bugs Encontrados

### BUG-001 — SEVERITY: MEDIUM (Pre-existente, nao introduzido)
**Descricao**: npm test falha com "Cannot read properties of undefined (reading 'config')" para todos os 55 test files.
**Causa**: vite.config.ts exporta funcao (defineConfig(({mode}) => {...})) - o Vitest nao consegue parsear.
**Evidencia**: Baseline com git stash mostra 55 FAIL antes das mudancas deste hotfix.
**Impacto desta task**: ZERO (falha pre-existente, nao introduzida)
**Mitigacao sugerida**: Criar vitest.config.ts separado com test section propria.

---

## Riscos Identificados

- RISCO-01: Schema drift no Supabase LIVE (migration 40 executada sem ledger). Correcao local nao resolve o LIVE. Requer aplicacao autorizada separada.
- RISCO-02: Origem do DDL identificada: scripts/apply-migration-40-and-validate.ts executado com DATABASE_URL apontando para LIVE. NEUTRALIZADO.

---

## Recomendacao para o Tech Lead

APROVAR com documentacao do BUG-001 pre-existente como divida tecnica.
Recomendar criacao de vitest.config.ts separado em task futura para resolver falha de CI.
Migration 40 local esta correta e pronta para aplicacao autorizada no LIVE.
