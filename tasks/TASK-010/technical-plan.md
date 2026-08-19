TASK: TASK-010
STATUS: TECH_READY
OWNER: MAZZI Tech Lead
LAST_UPDATED: 2026-08-18T20:41:00-03:00

# Resumo Técnico

Identificamos que no ambiente Supabase LIVE, a função `public.create_quote_from_offering` foi regredida/sobrescrevida por alguma migração externa ou intervenção direta, omitindo os campos `provider_id`, `instructor_id` e `vehicle_id` tanto no comando de `INSERT` quanto no JSON de retorno. Esses campos são obrigatórios (`NOT NULL`) na tabela `quotes`, gerando a falha `23502` (null value in column violates not-null constraint).

A migration 40 local (`20260818000040_restore_slot_contract_and_readonly_availability.sql`) já possui a definição correta e completa da função, incluindo a idempotência atômica segura (`ON CONFLICT (student_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING`) e os 14 campos no contrato de retorno.

# Código Existente Relacionado

* Arquivo local: `supabase/migrations/20260818000040_restore_slot_contract_and_readonly_availability.sql` (Linhas 281 a 505).
* Banco LIVE: A função `public.create_quote_from_offering` no Supabase.

# Arquivos Afetados

* `[MODIFY]` [20260818000040_restore_slot_contract_and_readonly_availability.sql](file:///D:/mazzi_premium_ui_v2/supabase/migrations/20260818000040_restore_slot_contract_and_readonly_availability.sql) - Validar que a definição local está 100% correta e em conformidade.

# Banco de Dados & Migrations Afetadas

* **Supabase LIVE:** Aplicar a DDL da função `public.create_quote_from_offering` corrigida diretamente na base de dados produtiva.
* **Ledger de Migrações:** O ledger do LIVE já contém o registro da versão `20260818000040`, portanto a reconciliação direta de versão não é necessária para ela. No entanto, auditamos o drift causado pelas versões `20260818151546` e `20260818152021` que estão no LIVE, mas não no repositório local. Como a instrução proíbe push, merge ou criação de novas migrations (se a 40 já está no banco e a instrução diz "Não criar migration 41 se a migration 40 ainda não estiver oficialmente registrada", e como a 40 está registrada localmente e remotamente), o plano é aplicar a DDL diretamente no LIVE e manter a migration 40 local corrigida.

# RLS e RBAC Afetados

* Nenhuma tabela ou política de RLS foi alterada. Os privilégios de execução (`EXECUTE`) na função serão mantidos estritamente para a role `authenticated`, com `SECURITY DEFINER` e `search_path` seguro (`public`, `pg_temp`), como definido na migration 40.

# Estratégia de Implementação

1. **Revisar migration 40 local:** Garantir que o script local de criação da função `create_quote_from_offering` está totalmente correto.
2. **Executar Hotfix no Supabase LIVE:** Usar um script Node.js para rodar a DDL da função corrigida diretamente na base de dados LIVE conectando via `DATABASE_URL`.
3. **Validar Função no LIVE:** Consultar `pg_get_functiondef` no banco de dados LIVE e verificar se os campos foram aplicados corretamente.
4. **Executar Testes de Fluxo:** 
   - Criar uma quote de teste usando uma `offering_id` ativa no LIVE (por exemplo, `8bfdb17b-0e6b-4dad-b32a-4a0546e84510`).
   - Validar retorno HTTP 200 (sucesso) e preenchimento de todos os IDs (`provider_id`, `instructor_id`, `vehicle_id`).
   - Testar reuso de idempotency key com parâmetros idênticos (deve retornar a mesma quote com `is_idempotent = true`).
   - Testar reuso de idempotency key com parâmetros diferentes (deve retornar erro `23505`).
   - Testar reuso com quote expirada (deve retornar erro `22023`).
   - Validar que o fluxo de booking hold posterior (`create_booking_hold`) funciona.
5. **Quality Gates locais:** Rodar `npm run lint`, `npm test` e `npm run build:all`.

# Ordem de Implementação

1. Validação/Ajuste no arquivo de migration local.
2. Script de aplicação da DDL no banco LIVE.
3. Script de teste de integração (criação de quote e idempotência) no banco LIVE.
4. Execução de lint, testes unitários e builds locais.

# Testes Obrigatórios

* Chamada direta ao RPC `create_quote_from_offering` via Node.js com assertions detalhadas de retorno e banco de dados.
* Teste de idempotência (mesmo request, request diferente, request expirado).
* Teste de concorrência e double-booking.

# Riscos e Mitigações

* **Risco:** Quebra de disponibilidade do agendamento durante o hotfix.
* **Mitigação:** A atualização é uma DDL atômica (`CREATE OR REPLACE FUNCTION`) que leva milissegundos e não bloqueia leituras.

# O que NÃO Alterar

* Não alterar a tabela `quotes` ou `service_offerings`.
* Não modificar o frontend nem fazer commits/push.

# Instruções para o MAZZI Dev

* Use a string de conexão de banco de dados `.env.local`.
* Certifique-se de que a função executa `SECURITY DEFINER` e tem tratamento adequado de concorrência com `ON CONFLICT`.
