# TASK-006 — Idempotência Atômica no Create Quote (Race Condition Fix)

**TASK**: TASK-006  
**STATUS**: PRODUCT_READY  
**OWNER**: MAZZI Product  
**LAST_UPDATED**: 2026-08-18

---

## Objetivo

Eliminar a condição de corrida TOCTOU (Time-Of-Check Time-Of-Use) na criação do quote de checkout, garantindo que múltiplas chamadas simultâneas com a mesma `idempotency_key` nunca gerem erro `23505 / HTTP 409` e retornem sempre o mesmo `quote_id`.

---

## Problema

O RPC `public.create_quote_from_offering` executa:

1. `SELECT` em `public.quotes` buscando `(student_id, idempotency_key)`
2. Se não encontrou → `INSERT normal`

Quando duas ou mais requests chegam simultaneamente, ambas passam pelo `SELECT` sem encontrar registro (ambas encontram vazio), e então ambas tentam o `INSERT`. A segunda falha com `duplicate key value violates unique constraint "uq_quotes_student_idempotency"` — erro `23505`, que o PostgREST traduz em HTTP 409.

O agendamento é concluído na primeira tentativa, mas o erro no console indica uma segunda chamada concorrente que falha desnecessariamente. Do ponto de vista do produto, isso é um bug crítico de UX e estabilidade.

---

## Usuário Afetado

- **STUDENT**: ao abrir o CheckoutModal, o `useEffect` pode disparar `createQuoteFromOffering` mais de uma vez (re-render, StrictMode, mudança de dep), gerando chamadas concorrentes.

---

## Escopo

**O que entra nesta entrega:**

1. Tornar o `INSERT` no RPC `create_quote_from_offering` **atomicamente idempotente** via `INSERT ... ON CONFLICT DO NOTHING RETURNING *` — elimina a janela TOCTOU no banco de dados.
2. Adicionar proteção **single-flight** no frontend (CheckoutModal): apenas uma chamada de criação de quote pode estar ativa ao mesmo tempo durante uma sessão de checkout.
3. Garantir que `is_idempotent = true` não seja tratado como `QUOTE_CREATE_FAILED` pelo `db-service.ts`.
4. Preservar rejeição de **reutilização incorreta** de chave (mesma key com offering ou slot diferente).

---

## Fora de Escopo

- Cancelamento (DEC-013)
- Pagamentos / FakePaymentGateway
- Auth / CPF / birth_date
- Search / Providers / Vehicles
- Slots engine
- Templates de email
- Outras RPCs

---

## Regras de Negócio

- **RN-01**: Duas chamadas com mesmo `(student_id, idempotency_key, offering_id, scheduled_start_at)` devem retornar `success=true, is_idempotent=true` e o **mesmo** `quote_id`. Somente uma linha deve existir.
- **RN-02**: A inserção deve ser **atômica** — sem janela entre SELECT e INSERT.
- **RN-03**: Uma `idempotency_key` reutilizada com `offering_id` ou `scheduled_start_at` diferente deve retornar `QUOTE_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST`.
- **RN-04**: Nenhuma chamada legítima (retry / double-click / re-render) deve gerar HTTP 409 ou 23505 visível ao usuário.
- **RN-05**: A `idempotency_key` para um mesmo slot de checkout deve ser **estável** durante toda a sessão do modal — não regenerar em cada render.
- **RN-06**: Todas as validações de segurança existentes (auth, role, offering, slot disponível, preço, expiração) devem ser preservadas integralmente.

---

## Fluxo Principal (Happy Path)

1. Usuário abre CheckoutModal para `offering X` + `slot Y`
2. Frontend gera `idempotency_key = idem_quote_{offering.id}_{scheduledStartAt}` uma única vez (já existente)
3. Um único `createQuoteFromOffering` é disparado
4. RPC faz `INSERT ... ON CONFLICT (student_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING RETURNING *`
5. Se INSERT retornou linha → `is_idempotent = false` → retorna novo quote
6. Se INSERT não retornou linha → busca a linha existente → valida `offering_id` e `scheduled_start_at` → retorna `is_idempotent = true`
7. Frontend recebe quote e prossegue normalmente

---

## Casos de Borda e Exceções

- **10 requests simultâneas, mesma key**: apenas 1 INSERT ocorre, todas retornam o mesmo quote_id.
- **Retry após falha de rede com mesma key**: retorna quote existente, checkout continua.
- **Re-render / StrictMode**: single-flight no frontend evita segunda chamada; banco é fallback seguro.
- **Key reutilizada com offering diferente**: erro `QUOTE_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST`.
- **Key reutilizada com mesmo offering mas slot diferente**: mesmo erro.

---

## Critérios de Aceite

- **AC01**: Chamada única retorna `success=true, is_idempotent=false`, 1 linha criada.
- **AC02**: Segunda chamada sequencial com mesma key retorna `success=true, is_idempotent=true`, mesmo `quote_id`.
- **AC03**: 10 chamadas simultâneas (Promise.all) com mesma key: 10 respostas de sucesso, COUNT de linhas = 1, 0 erros 23505.
- **AC04**: Key reutilizada com offering diferente → `QUOTE_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST`.
- **AC05**: Key reutilizada com mesmo offering mas slot diferente → erro equivalente.
- **AC06**: Double-click no botão de checkout não dispara segunda operação de criação.
- **AC07**: Agendamento E2E sem erro 409 no console.
- **AC08**: CPF, birth_date, cancelamento, pagamentos, search — sem regressão.

---

## Dependências

- Índice único `uq_quotes_student_idempotency ON public.quotes (student_id, idempotency_key) WHERE idempotency_key IS NOT NULL` — **já existe no banco remoto**.
- RPC `create_quote_from_offering(uuid, timestamptz, varchar)` — **já existe, será substituído atomicamente via migration**.

---

## Riscos de Produto

- Nenhum risco de dados: a lógica de negócio das validações é preservada.
- Risco de reversão: migration `CREATE OR REPLACE FUNCTION` é idempotente por natureza.

---

## Handoff para Tech Lead

- Confirmar que `uq_quotes_student_idempotency` existe e é o índice correto para o `ON CONFLICT`.
- Planejar `INSERT ... ON CONFLICT DO NOTHING RETURNING *` + `SELECT` subsequente atômico dentro do mesmo bloco PL/pgSQL.
- Garantir que frontend não chame `createQuoteFromOffering` mais de uma vez por sessão de modal via `useRef` single-flight.
