# TASK-006 — Plano Técnico: Idempotência Atômica no Create Quote

**TASK**: TASK-006  
**STATUS**: TECH_READY  
**OWNER**: MAZZI Tech Lead  
**LAST_UPDATED**: 2026-08-18

---

## Resumo Técnico

O `create_quote_from_offering` sofre de TOCTOU clássico: SELECT + INSERT separados permitem duas transações concorrentes passarem pelo SELECT (ambas encontram vazio) e então colidirem no INSERT, gerando `23505`. 

O índice único `uq_quotes_student_idempotency ON public.quotes (student_id, idempotency_key) WHERE idempotency_key IS NOT NULL` já existe no banco — é o mecanismo correto. A correção é eliminar o SELECT prévio e usar `INSERT ... ON CONFLICT DO NOTHING RETURNING *` atomicamente, fazendo um `SELECT` pós-INSERT somente se nenhuma linha foi retornada (conflito detectado).

No frontend, o `useEffect` em `CheckoutModal.tsx` pode disparar `initializeQuote()` mais de uma vez por mudança de deps (incluindo React StrictMode em dev). Um `useRef` de guard impede a segunda chamada.

---

## Código Existente Relacionado

- `supabase/migrations/20260815000009_quote_booking.sql`: criação original de `quotes` e índices
- `supabase/migrations/20260815000015_sprint15_security_hardening.sql`: índice `uq_quotes_student_idempotency` confirmado existente
- `src/apps/student/components/CheckoutModal.tsx` L136–221: `useEffect` que chama `initializeQuote()` sem guard de single-flight
- `src/lib/db-service.ts` L726–744: `createQuoteFromOffering()` — não trata `is_idempotent=true` de forma especial (já passa direto)

---

## Arquivos Afetados

### [NEW] `supabase/migrations/20260818000038_fix_quote_idempotency_race.sql`
- DROP + CREATE OR REPLACE da função `create_quote_from_offering`
- Substitui SELECT+INSERT por INSERT...ON CONFLICT DO NOTHING RETURNING * + SELECT de fallback

### [MODIFY] `src/apps/student/components/CheckoutModal.tsx`
- Adicionar `useRef<boolean>` de single-flight (`quoteInitInFlightRef`)
- Guard no início de `initializeQuote()` para evitar chamadas concorrentes
- Reset do guard ao fechar o modal / mudar o slot

### [MODIFY] `src/lib/db-service.ts`
- `createQuoteFromOffering`: verificar que `is_idempotent=true` retornado pelo RPC é tratado como sucesso (não erro)

### [NEW] `tests/quote-idempotency-race.test.ts`
- Testes unitários: Caso 1 (normal), Caso 2 (retry sequencial), Caso 3 (mock concorrente), Caso 4 (key reuse inválido), Caso 5 (double-click frontend), Caso 6 (retry de rede)

---

## Banco de Dados & Migrations

- **Migration**: `20260818000038_fix_quote_idempotency_race.sql` (próxima sequência)
- **Não cria** novas tabelas, colunas, índices ou constraints — o índice `uq_quotes_student_idempotency` já existe
- Substitui apenas a função PL/pgSQL via `CREATE OR REPLACE FUNCTION`
- Preserva: `SECURITY DEFINER`, `SET search_path = public, pg_temp`, grants para `authenticated`, revoke de `PUBLIC`/`anon`

---

## RLS e RBAC Afetados

Nenhuma RLS ou RBAC alterada. O RPC continua sendo `SECURITY DEFINER` e valida `auth.uid()` internamente.

---

## Estratégia de Implementação

### Passo 1 — RPC (banco)

Substituir:
```sql
SELECT * INTO v_existing FROM quotes WHERE student_id=v_uid AND idempotency_key=p_idempotency_key LIMIT 1;
IF found THEN ... END IF;
INSERT INTO quotes(...) VALUES(...);
```

Por:
```sql
INSERT INTO public.quotes(...) VALUES(...) ON CONFLICT (student_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING RETURNING * INTO v_inserted_row;

IF v_inserted_row IS NULL THEN
  -- Conflito detectado: buscar a linha existente
  SELECT * INTO v_existing FROM public.quotes WHERE student_id=v_uid AND idempotency_key=p_idempotency_key;
  -- Validar que é o mesmo request
  IF v_existing.offering_id <> p_offering_id OR v_existing.scheduled_start_at <> p_scheduled_start_at THEN
    RAISE EXCEPTION 'QUOTE_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST' USING ERRCODE='23505';
  END IF;
  -- Retornar idempotente
  RETURN jsonb com is_idempotent=true;
ELSE
  -- Inserção bem-sucedida
  RETURN jsonb com is_idempotent=false;
END IF;
```

**Importante**: o `INSERT` ainda faz todas as validações de slot, offering, provider etc. **antes** do INSERT. A sequência completa é: validar → INSERT ON CONFLICT → tratar resultado.

### Passo 2 — Frontend single-flight

Em `CheckoutModal.tsx`:
```typescript
const quoteInitInFlightRef = useRef(false);

const initializeQuote = async () => {
  if (quoteInitInFlightRef.current) return; // guard
  quoteInitInFlightRef.current = true;
  try { ... } finally { quoteInitInFlightRef.current = false; }
};
```

Reset do ref quando `isOpen` muda para false (modal fecha) ou quando o slot/offering mudam.

### Passo 3 — db-service.ts

O `createQuoteFromOffering` já retorna `data` diretamente. Verificar que o caller em `CheckoutModal.tsx` usa `rpcRes.quote_id` mesmo quando `is_idempotent=true` — o código existente já faz isso pois mapeia `rpcRes.quote_id` diretamente.

---

## Ordem de Implementação

1. Criar migration `20260818000038_fix_quote_idempotency_race.sql`
2. Aplicar migration no Supabase remoto via `supabase db push`
3. Modificar `CheckoutModal.tsx` — single-flight ref
4. Verificar `db-service.ts` — sem tratamento especial necessário (já funciona)
5. Criar `tests/quote-idempotency-race.test.ts`
6. Executar testes, lint, build

---

## Testes Obrigatórios

- AC01: criação normal
- AC02: retry sequencial = mesma quote_id
- AC03: 10 promises simultâneas = 1 quote no banco
- AC04: key reuse com offering diferente = erro
- AC05: key reuse com slot diferente = erro
- AC06: double-click frontend = 1 operação
- AC07: E2E agendamento sem 409

---

## Riscos e Mitigações

| Risco | Mitigação |
|---|---|
| `INSERT ON CONFLICT` não encontrar o índice correto | Confirmado via pg_indexes: `uq_quotes_student_idempotency` existe |
| Validações feitas antes do INSERT passam slot inválido | Validações não mudam de posição — apenas o INSERT+fallback-SELECT é reestruturado |
| `v_inserted_row` retornar NULL em `RETURNING * INTO` quando sem conflito | Usar `IS NOT FOUND` em vez de `IS NULL` para rowtype |

---

## O que NÃO Alterar

- `cancel_booking_v2` e fluxo de cancelamento
- `create_booking_hold`, `create_booking_payment`
- `FakePaymentGateway`
- RLS/RBAC existentes
- Auth, CPF, birth_date
- Search, slot engine, providers, vehicles

---

## Instruções para o MAZZI Dev

1. Criar `20260818000038_fix_quote_idempotency_race.sql` com `CREATE OR REPLACE FUNCTION public.create_quote_from_offering`
2. Usar `DECLARE v_inserted_row public.quotes%rowtype;` para capturar o resultado do `INSERT ... RETURNING *`
3. Verificar `v_inserted_row.id IS NULL` para detectar conflito (RETURNING retorna vazio quando ON CONFLICT DO NOTHING)
4. Adicionar `useRef<boolean>` guard em `CheckoutModal.tsx` antes do `initializeQuote()`
5. Aplicar com `supabase db push --db-url $DATABASE_URL`
6. Rodar teste de concorrência real com 5 a 10 promises
