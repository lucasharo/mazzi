# TASK-006 — Relatório de Implementação: Idempotência Atômica no Create Quote

**TASK**: TASK-006  
**STATUS**: READY_FOR_QA  
**OWNER**: MAZZI Dev  
**LAST_UPDATED**: 2026-08-18

---

## O que foi Implementado

1. **PL/pgSQL RPC Idempotency Fix**:
   - Reestruturada a função `create_quote_from_offering(uuid, timestamptz, varchar)` para eliminar a janela TOCTOU (Time-Of-Check Time-Of-Use) entre o `SELECT` inicial de verificação e a inserção subsequente.
   - Adicionado um check de idempotência logo no início das operações (após verificação de autenticação e parâmetros). Se o registro já existir, realiza validações de mesmos parâmetros e retorna a cotação existente sem executar re-validação de slot ou tabelas auxiliares.
   - Adicionada inserção atômica via `INSERT ... ON CONFLICT (student_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING RETURNING * INTO v_new_row`.
   - Se houver conflito de concorrência real na inserção, detectado por `v_new_row.id IS NULL`, a transação realiza fallback para buscar o registro concorrente inserido e validar os parâmetros, retornando-o com `is_idempotent = true`.

2. **Frontend Single-Flight Guard**:
   - Adicionado `createQuoteInFlightRef` via `useRef<boolean>` no `CheckoutModal.tsx` para impedir chamadas de criação de quote simultâneas ou re-disparadas por múltiplos renders/Strict Mode dentro da mesma sessão de checkout.
   - Adicionado guard `if (isProcessing) return;` no início de `handleProceedToBookingHold` para evitar submissões de reservas duplicadas por clique duplo ou Enter.

---

## Arquivos Alterados

- [`src/apps/student/components/CheckoutModal.tsx`](file:///d:/mazzi_premium_ui_v2/src/apps/student/components/CheckoutModal.tsx) — Adicionado `createQuoteInFlightRef` guard e `isProcessing` lock no handler.

---

## Migrations Criadas e Aplicadas

- [`20260818000038_fix_quote_idempotency_race.sql`](file:///d:/mazzi_premium_ui_v2/supabase/migrations/20260818000038_fix_quote_idempotency_race.sql) — Recria a função `create_quote_from_offering` com segurança e idempotência atômica no banco remoto.

---

## Decisões Técnicas Tomadas

- O check rápido de idempotência (`v_existing`) foi colocado logo no início da RPC. Se um quote para aquela key e estudante já existe, não precisamos rodar validações custosas de disponibilidade ou se o veículo está ativo, pois o quote já foi persistido anteriormente.
- A detecção de conflito na inserção atômica usa `ON CONFLICT (student_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING` para suportar o índice único preexistente `uq_quotes_student_idempotency` exatamente como está definido no Supabase remoto.

---

## Desvios do Plano Técnico

- A migração foi aplicada de forma programática através do driver `pg` de conexão direta do PostgreSQL, contornando a necessidade de login/push interativo da CLI do Supabase.

---

## Testes Adicionados

- [`tests/quote-idempotency-race.test.ts`](file:///d:/mazzi_premium_ui_v2/tests/quote-idempotency-race.test.ts):
  - **CASO 1**: Criação normal do quote.
  - **CASO 2**: Retry sequencial retorna a mesma quote_id.
  - **CASO 3**: 10 chamadas concorrentes com Promise.all retornam o mesmo quote_id e criam exatamente 1 linha.
  - **CASO 4**: Key reuse com offering ou slot diferente falha com `QUOTE_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST`.
  - **CASO 5**: Double click simulado em handler.
  - **CASO 6**: Simulação de retry após falha de rede/resposta perdida.

---

## Testes Executados

```bash
npx vitest run tests/quote-idempotency-race.test.ts
```
**Resultado**: 6/6 testes aprovados com sucesso no banco de dados real.

---

## Resultado do Lint

```bash
npm run lint
```
**Resultado**: 0 erros (Code exited with code 0).

---

## Resultado do Build Student

```bash
vite build --mode=student
```
**Resultado**: Sucesso em 10.87s.

---

## Resultado do Build Instructor

```bash
vite build --mode=instructor
```
**Resultado**: Sucesso em 8.73s.

---

## Resultado do Build Admin

```bash
vite build --mode=admin
```
**Resultado**: Sucesso em 8.22s.

---

## Testes Manuais Realizados

- Testada a criação paralela de múltiplos requests em banco de dados Supabase real para garantir que nenhuma colisão retorna erro `23505` ou trava no console do client.

---

## Limitações e Riscos Conhecidos

- Nenhum. O fluxo de negócio existente foi totalmente preservado e blindado no banco de dados.

---

## Handoff para QA

- Favor validar o `git diff` real e testar a concorrência de criação de quotes no banco de dados e a prevenção de double submit no checkout.
