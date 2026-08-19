TASK: TASK-010
STATUS: PRODUCT_READY
OWNER: MAZZI Product
LAST_UPDATED: 2026-08-18T20:41:00-03:00

# Objetivo

Corrigir o hotfix de criação de quote a partir de uma oferta (`create_quote_from_offering`) na base de dados PostgreSQL/Supabase. A função atual no ambiente LIVE gera uma violação de restrição `NOT NULL` (`23502`) ao omitir os campos obrigatórios `provider_id`, `instructor_id` e `vehicle_id` na tabela `quotes`.

# Problema

Ao tentar criar uma quote de agendamento usando o RPC `create_quote_from_offering`, a transação falha com código `23502` porque a função SQL não atribui valores aos campos `provider_id`, `instructor_id` e `vehicle_id`, os quais são definidos como `NOT NULL` na tabela `quotes`. Além disso, a migration 40 local precisa ser revisada e auditada contra o Supabase LIVE, reconciliando o ledger de migrações se necessário.

# Usuário Afetado

* `STUDENT` (estudante tentando agendar uma aula prática)
* `INSTRUCTOR` / `SCHOOL_ADMIN` (impactados pelo fluxo quebrado de agendamento)

# Escopo

* Auditoria e reconciliação do Supabase Migration Ledger no ambiente LIVE para a migration 40.
* Correção da função `public.create_quote_from_offering` no arquivo local `supabase/migrations/20260818000040_restore_slot_contract_and_readonly_availability.sql`.
* Aplicação da correção da função no banco de dados Supabase LIVE (`bhvpkgonhlujmxvwnxix`).
* Manutenção e preservação do contrato de idempotência atômica da quote.
* Manutenção das consultas de disponibilidade de slots como STABLE/Read-Only (sem regressão para "cannot execute UPDATE in a read-only transaction").

# Fora de Escopo

* Alterações ou publicações no frontend.
* Commits/Pushes/Merges na branch `main` ou `premium_ui_v2` remota (tudo deve permanecer estritamente local e apenas as modificações diretas no banco de dados LIVE são permitidas).
* Alterações de regras de preço ou alteração direta na tabela de ofertas (`service_offerings`).

# Regras de Negócio

1. **Campos Obrigatórios da Quote:** Ao criar um registro em `public.quotes`, as colunas `provider_id`, `instructor_id` e `vehicle_id` devem ser preenchidas obrigatoriamente usando os valores correspondentes da oferta associada (`v_offering`).
2. **Contrato de Resposta JSON:** O retorno do RPC `create_quote_from_offering` deve retornar um JSON com exatamente os seguintes campos de dados: `success`, `is_idempotent`, `quote_id`, `student_id`, `provider_id`, `instructor_id`, `vehicle_id`, `offering_id`, `scheduled_start_at`, `scheduled_end_at`, `price_in_cents`, `platform_fee_in_cents`, `total_in_cents`, `status`, `expires_at`.
3. **Idempotência Atômica:**
   - Mesma tentativa (mesmo student, mesma idempotency key, mesma offering, mesmo horário, status ACTIVE e dentro do prazo de expiração) deve retornar a quote já criada com `is_idempotent = true`.
   - Mesma chave com parâmetros diferentes deve lançar exceção `QUOTE_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST` (código `23505`).
   - Chave reusada com quote expirada ou consumida deve lançar exceção `QUOTE_IDEMPOTENCY_KEY_STALE` (código `22023`).
4. **Sem Conflito Concorrente:** A criação deve usar `ON CONFLICT (student_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING` para evitar condições de corrida (TOCTOU).

# Critérios de Aceite

* **AC01:** Chamar o RPC `create_quote_from_offering` com dados corretos de oferta ativa e slot livre deve retornar HTTP 200, criar a quote no banco preenchendo `provider_id`, `instructor_id` e `vehicle_id` com os respectivos dados da oferta.
* **AC02:** Chamar o RPC com a mesma idempotency key e parâmetros iguais deve retornar a mesma quote com `is_idempotent = true` e sem duplicar o registro no banco de dados.
* **AC03:** Chamar com a mesma key mas parâmetros de data ou oferta diferentes deve disparar erro `QUOTE_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST`.
* **AC04:** Chamar com key já expirada no banco deve disparar erro `QUOTE_IDEMPOTENCY_KEY_STALE`.
* **AC05:** Consultas de busca de slots como `get_available_slots_public` devem continuar funcionando normalmente e sem causar transações voláteis/de escrita.
* **AC06:** A migration 40 local deve estar com a definição correta e o banco de dados LIVE deve estar com a migration 40 devidamente registrada no ledger de migrações (`supabase_migrations.schema_migrations`).

# Dependências

* Acesso ao banco de dados Supabase LIVE através da string de conexão do arquivo `.env.local`.

# Decisões Pendentes

Nenhuma. As diretrizes do hotfix são explícitas.

# Riscos de Produto

* Risco de concorrência e double-booking caso a proteção de idempotência atômica não seja preservada.
* Risco de quebrar a consulta de slots se DML for reintroduzido em funções marcadas como estáveis.
