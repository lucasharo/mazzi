# MAZZI — TASK-096A4M-R5 QA Report

## Estado vigente após R12

- R10: PASS; R10D: PASS; R11: PASS; R11A: PASS.
- Supabase DEV: alinhado ao ledger e aos contratos canônicos validados.
- Git: consolidação pendente de autorização de commit.
- Production, LIVE e `spatial_ref_sys`: inalterados nesta consolidação.
- Este documento preserva as seções históricas abaixo; bloqueios anteriores não representam o estado vigente.

## TASK-096A4M-R12A — alinhamento do baseline candidato

- Baseline candidato: **CANONICAL / ALIGNED** para os contratos R10D e R11.
- Incluídos: helper de versão dos termos, aceite server-authoritative, elegibilidade de
  ativação, promoção USER_GLOBAL/PROVIDER e ciclo de vida de ofertas.
- O arquivo de referência contém somente o requisito canônico de aceite dos termos, sem PII.
- Comparação estática com as migrations `20260825151539` e `20260825172601`: PASS.
- Supabase DEV: somente consultas read-only; nenhuma mutation, migration ou DDL foi executada.
- Docker/replay local: skipped (indisponível; não é gate desta task).

Data: 2026-08-25. Escopo: auditoria read-only do Supabase LIVE e regressão local.

## Status objetivo

**PASS (preparação local)** para a migration forward-only. A publicação no LIVE
continua deliberadamente pendente e não foi executada nesta task.

## Baseline local

- Branch: `feature/premium-ui-v2`
- HEAD: `a4dd64f4665c42c015e0bc70806aae4ede656cb5`
- Último commit: `a4dd64f chore(db): align student pro migration ledger`
- Worktree já possuía alterações locais e `supabase/baseline-candidate/`; preservados.
- Branch local `main` inexistente; nenhum checkout, reset ou limpeza executado.
- Migrations locais: 105; última `20260825030830_task_096a4m_r_student_to_pro_profile_migration.sql`.
- CI: `main` e `feature/**`, com lint, testes e `build:all`.
- Apps: Student 3001, Instructor/PRO 3002, Admin 3003, Design System 3004.

## Consultas LIVE read-only

Foi usada somente a chave pública/anon e uma sessão autenticada do usuário Admin, sem imprimir tokens.

- Endpoint REST Supabase: alcançável.
- `compliance_documents` anônimo: negado por privilégio, esperado para tabela privada.
- `compliance_documents` autenticado como Admin: HTTP 200 com metadados limitados.
- `list_my_global_compliance`: HTTP 200.
- `is_instructor_global_compliance_valid`: HTTP 200.
- `is_membership_compliance_valid`: HTTP 200.
- `is_provider_instructor_eligible`: HTTP 200.
- Nenhuma RPC mutável foi invocada.
- Nenhum INSERT, UPDATE, DELETE, upload, DDL ou migration foi executado.

## Bloqueador confirmado

O endpoint do bucket `provider-compliance-docs` retornou HTTP 400, `NoSuchBucket`, `Bucket not found`.

A migration local `20260814000005_compliance_regulatory_hardening.sql` prevê esse bucket como privado, mas o objeto não existe no LIVE auditado.

## Itens inconclusivos por limitação segura

- A API REST pública não fornece o catálogo completo de funções/assinaturas nem o ledger de migrations.
- `OPTIONS` não é evidência suficiente de existência ou assinatura de RPC.
- A semântica LIVE de `provider_save_service_offering` não foi invocada, pois isso seria RPC mutável.
- Nenhum conteúdo de documento, caminho privado ou URL assinada foi exposto.

## Comparação local

Compatível localmente:

- `USER_GLOBAL` é definido para documentos globais de instrutor.
- Upload global passa pelo RPC que deriva `auth.uid()`.
- Admin relaciona documentos globais por `user_id` e documentos contextuais por `provider_id`/`membership_id`.
- Oferta ativa mantém validação server-side de provider `ACTIVE`.
- Storage local previsto como bucket privado `provider-compliance-docs`.

Divergência LIVE: bucket privado ausente — **dependência para publicação futura**.

## TASK-096A4M-R6 — preparação forward-only

Migration criada:
`supabase/migrations/20260825120000_task_096a4m_r6_provider_compliance_storage.sql`.

Ela provisiona/reconcilia somente o bucket privado `provider-compliance-docs`
(10 MB; PDF, JPEG, PNG e WebP) e policies mínimas para o caminho
`providers/{provider_id}/compliance/{document_id}/{filename}`. Upload e leitura
exigem sessão ativa e ownership seguro; reviewer autorizado pode ler; exclusão
é limitada ao proprietário ou reviewer; não há policy de UPDATE e anon não tem
acesso. Nenhuma linha de `compliance_documents` é alterada.

O teste `tests/task-096a4m-r6-storage.test.ts` valida o contrato sem credenciais
reais e sem upload no LIVE.

## Próxima publicação segura

1. Confirmar o ledger LIVE por canal privilegiado de auditoria.
2. Revisar a migration R6 forward-only criada localmente.
3. Aplicar somente em uma task autorizada de publicação e validar bucket/policies.
4. Validar RPCs, assinaturas, grants e RLS após publicação.

Não reaplicar cegamente a migration histórica M05.

## Validação local

- Testes direcionados anteriores: 23 passed, 0 failed.
- Teste R6: validação estática do bucket, path, MIME, limite, policies e não exposição.
- `npm test`: 694 passed, 0 failed, 0 skipped.
- `npm run lint`: PASS.
- `npm run build:all`: PASS para Student, Instructor/PRO e Admin.
- `git diff --check`: PASS.

## Segurança e alterações

- LIVE consulted: YES.
- LIVE changed: NO.
- Deploy manual: NO.
- Commit: NÃO realizado.
- Push: NÃO realizado.
- Production/main: não alterados.

## TASK-096A4M-R9 — preflight read-only de publicação

### Baseline local

- Branch: `feature/premium-ui-v2`
- HEAD: `a4dd64f4665c42c015e0bc70806aae4ede656cb5`
- Último commit: `a4dd64f chore(db): align student pro migration ledger`
- `main`: não há referência local `refs/heads/main`; nenhuma alteração foi feita nela.
- Worktree e `supabase/baseline-candidate/` foram preservados.

### LIVE — somente leitura

- Ledger mais recente: `20260825040308 task_096a4n_public_search_instructor_avatar_fallback`.
- R6 (`20260825120000_task_096a4m_r6_provider_compliance_storage`): ausente do ledger.
- R8 (`20260825130000` e `20260825130001`): ausentes do ledger.
- Bucket `provider-compliance-docs`: existente, privado, limite 10 MB, MIME PDF/JPEG/PNG/WebP.
- Enum LIVE naquele preflight: `PENDING`, `APPROVED`, `REJECTED`, `EXPIRED`; `IN_REVIEW` ausente.
- Dados agregados naquele preflight: `APPROVED=236`, `REJECTED=1`; nenhum dado com status legado ou `EXPIRED`.
- Colunas de escopo, identidade, validade e revisão presentes; RLS/policies presentes.
- RPCs de compliance compatíveis com o cliente atual: `anon=false`, `authenticated=true`, `public=false`.

### Ordem recomendada

1. R6 Storage, após reconciliar o bucket existente com o ledger.
2. R8 add enum `IN_REVIEW`.
3. R8 canonicalização de dados, constraint, policies e RPCs.

R8 depende da etapa 2. A publicação fica bloqueada até reconciliar a R6 ausente do ledger e confirmar que bucket/policies existentes correspondem à migration local.

### Conversão agregada prevista

Não há linhas LIVE para converter nos valores antigos consultados. A migration ainda é necessária para o contrato do enum e para bloquear novos valores legados, preservando `expires_at` e histórico.

Nenhum documento, `storage_path` ou URL privada foi consultado.

### Queries read-only usadas

- `supabase_migrations.schema_migrations`: ledger e versões.
- `information_schema.columns`: contrato de `compliance_documents` e Storage.
- `pg_type`/`pg_enum`: enum e valores de status/escopo.
- `pg_constraint`: FKs, checks e trigger da tabela.
- `pg_policies`: policies e expressões de isolamento.
- `pg_proc`/`has_function_privilege`: assinaturas e EXECUTE por role.
- `storage.buckets`: existência, privacidade, limite e MIME types.
- `COUNT(*) GROUP BY status`: somente contagens agregadas de status.

O `supabase` CLI não está instalado/disponível neste ambiente; portanto a lista local foi validada pelos arquivos e o comando de ledger local foi registrado como indisponível.

### Riscos observados

- R6 não está registrada no ledger apesar de bucket/policies históricas já existirem; a policy atual não contém a policy separada de delete para reviewer prevista na R6.
- R8 não pode ser aplicada antes de adicionar `IN_REVIEW`.
- O advisor LIVE reportou `public.spatial_ref_sys` com RLS desabilitado; isso é fora do escopo e não foi corrigido automaticamente.

## R10A — publicação controlada de status canônicos

LIVE foi consultado e alterado somente pelas migrations autorizadas, em ordem R6 → R8A → R8B → R10A veículo. O bucket `provider-compliance-docs` permaneceu privado, com limite de 10 MB e MIME types PDF/JPEG/PNG/WebP. As quatro policies R6 de storage ficaram ativas, sem acesso anônimo.

Contagens agregadas finais: compliance APPROVED=236, REJECTED=1; veículos ACTIVE=97. Os enums operacionais usam somente os rótulos canônicos; `provider_save_vehicle` e as RPCs de compliance usam `IN_REVIEW`. Nenhum documento foi lido ou exposto; `spatial_ref_sys` não foi alterado.

Validação local: 715 testes passed, 0 skipped, 0 failed; lint PASS; builds Student/PRO/Admin PASS; diff check PASS. Commit, push e CI não realizados.

## R10B — bloqueio antes do DDL de enum/ativação

A auditoria confirmou que o provider INSTRUCTOR em DRAFT possui seis documentos PROVIDER aprovados, mas o helper LIVE atual verifica somente USER_GLOBAL; essa é a causa do falso DRAFT elegível. Foram preparadas migrations forward-only para reconstruir os enums e centralizar a ativação, incluindo backfill controlado.

A aplicação foi bloqueada antes do LIVE porque o fresh rebuild obrigatório não pôde ser executado: Docker/runtime local não está disponível (`npx supabase db reset --local` retornou `LegacyLocalDbRunningError`). As migrations R10B não foram aplicadas. Nenhum DDL adicional, alteração de provider ou reset LIVE foi executado.

## R10B — retomada autorizada no Supabase DEV

O bloqueio anterior por Docker/fresh rebuild foi cancelado pela task de retomada. A validação foi executada diretamente no projeto DEV `bhvpkgonhlujmxvwnxix`, sem reset local e sem tocar Production.

- `remove_legacy_review_enum_values_v2`: aplicada; `compliance_status` ficou `PENDING`, `APPROVED`, `REJECTED`, `EXPIRED`, `IN_REVIEW`; `vehicle_status` ficou `DRAFT`, `PENDING`, `IN_REVIEW`, `ACTIVE`, `INACTIVE`, `EXPIRED`, `BLOCKED`.
- `activate_eligible_instructor_providers_v2`: aplicada; helper canônico, trigger de aprovação final e backfill foram criados.
- `reconcile_instructor_compliance_scope_v2`: aplicada; documentos aprovados em `USER_GLOBAL` ou no próprio escopo `PROVIDER` são aceitos, sem aceitar escopo de outro provider.
- Linhas com status removido: compliance=0, vehicles=0.
- Providers: `INSTRUCTOR ACTIVE=61`, `DRIVING_SCHOOL ACTIVE=12`; eligible INSTRUCTOR não-ativos=0. O único DRAFT elegível foi promovido para ACTIVE.
- Bucket `provider-compliance-docs`: privado, 10 MB, PDF/JPEG/PNG/WebP; policies sem acesso anônimo e sem UPDATE amplo do bucket de compliance.
- Funções críticas não produzem status removido; `OFFERING_PROVIDER_NOT_ACTIVE` foi preservado.

Validação local posterior: targeted R10B e suites de compliance/veículos=42 passed; `npm test`=717 passed, 0 skipped, 0 failed; lint, builds Student/PRO/Admin e `git diff --check` PASS.

O working tree, `supabase/baseline-candidate/` e o stash de segurança foram preservados. Não houve commit, push, deploy, alteração de Production ou alteração de `spatial_ref_sys`. A busca textual foi concluída sem ocorrências do status removido.

## R10D — gate canônico de termos MAZZI

- `req_termo_conduta_mazzi`: scope normalizado para `PROVIDER`.
- Versão corrente server-side: `v1`.
- Versão arbitrária: rejeitada com `TERMS_VERSION_NOT_CURRENT`.
- Aceitação exige provider próprio, owner correto, escopo PROVIDER, documento aprovado e caminho canônico.
- Elegibilidade exige separadamente requisitos pessoais e termos vigentes.
- ACTIVE sem termos antes: 56; após: 0.
- INSTRUCTOR: ACTIVE=5, DRAFT=56. DRIVING_SCHOOL ACTIVE=12.
- Fixtures artificiais persistidas: 0; testes transacionais usaram rollback.
- Migration DEV: `20260825151539 enforce_current_mazzi_terms_for_instructor_activation`.
- Targeted=45 passed; full suite=720 passed, 0 skipped, 0 failed; lint/builds/diff-check PASS.

## R10C — limpeza canônica e ativação universal

- Migration DEV aplicada: `20260825145519 fix_instructor_auto_activation_scope`.
- Aprovação `USER_GLOBAL`: avalia todos os providers INSTRUCTOR DRAFT/PENDING_REVIEW do mesmo usuário.
- Aprovação `PROVIDER`: avalia somente o provider indicado pelo documento.
- Estados protegidos não entram nos candidatos.
- Auditoria usa o status real anterior do provider; retry em ACTIVE é idempotente.
- Ledger DEV alinhado sem mudança de versões: migrations antigas agora usam nomes canônicos.
- Busca textual local pelo identificador removido: 0 ocorrências.
- Validação: targeted=41 passed; full suite=716 passed, 0 skipped, 0 failed; lint/builds/diff-check PASS.

## R11 — consistência do ciclo de vida de ofertas

- Preflight DEV: 58 ofertas efetivamente ativas pertenciam a providers não ACTIVE; todas eram de providers INSTRUCTOR em DRAFT.
- Migration DEV aplicada: `20260825172601_enforce_provider_offering_lifecycle_consistency`.
- Backfill: 58 ofertas normalizadas para `INACTIVE`/`is_active=false`; 0 providers alterados e 0 ofertas de providers ACTIVE tocadas.
- Trigger `deactivate_provider_offerings_on_provider_lifecycle`: ao sair de ACTIVE, desativa as ofertas na mesma transação; ao retornar a ACTIVE, não reativa automaticamente.
- Invariante pós-migration: zero ofertas efetivamente ativas pertencem a provider não ACTIVE; 50 ofertas efetivamente ativas permanecem em providers ACTIVE.
- Smoke transacional com rollback: ACTIVE→DRAFT produziu 0 ofertas ativas; DRAFT→ACTIVE permaneceu com 0 ofertas ativas.
- Gates públicos de busca, slot, quote e ativação de oferta permanecem preservados; `OFFERING_PROVIDER_NOT_ACTIVE` continua existente.
- Storage permaneceu privado e `spatial_ref_sys` não foi alterado.
- Testes direcionados R11/regressão: 59 passed. Lint, builds e diff-check: PASS. A suíte completa registrou 722 passed, 1 failed por fixture remota preexistente em `rpc-cancellation-v2-real.test.ts` (conflito de exclusão de bookings), fora do escopo da R11.
- Não houve commit, push, deploy ou alteração de Production.

## R11A — isolamento da fixture remota de cancelamento

- Root cause corrigida: fixture global c007/c008 e intervalo passado fixo colidiam com dados DEV reais; a constraint `exclude_student_overlapping_bookings` não foi alterada.
- Fixtures c007/c008 stale removidas somente por seus IDs; após três execuções: 0 bookings e 0 audit logs remanescentes.
- O teste agora usa UUIDs aleatórios, um único offering coerente, intervalo passado de 50 minutos dinamicamente livre e setup transacional com rollback em falha.
- Cleanup permanece limitado aos IDs da execução e ocorre em `finally`.
- Cancellation test: 3/3 execuções, 5 passed em cada execução.
- Failure-safety helper: PASS; falha no segundo insert gera rollback sem commit.
- Suíte completa: 724 passed, 0 skipped, 0 failed. Lint, builds e diff-check: PASS.
- R11: 0 ofertas ativas de providers não ACTIVE; 50 ofertas ativas de providers ACTIVE. R10D: 0 instrutores ACTIVE sem termos aprovados vigentes.
- Nenhuma migration, constraint, schema, Storage, `spatial_ref_sys`, Production, commit, push ou deploy foi alterado.
## Edição de veículos pelo PRO

- Card de veículo com ação `Editar`.
- Modal de cadastro reutilizado para edição, com dados preenchidos.
- RPC recebe o ID existente e evita duplicação.
- Veículos ativos/inativos alterados retornam a `IN_REVIEW` para aprovação do Admin.
- Frontend não promove nem aprova veículos.
- Lint, builds e teste direcionado passaram; `git diff --check` passou.

## Auditoria de alterações recentes

- Endereço/CEP/Geoapify/autocomplete: `0e6f84a`, `5aacba5`, `91d1ac6`.
- Modais e rotas mobile: `52ca1ab`.
- Cadastro público de autoescola: `d2487b5`.
- Defaults e notificações contextuais: `8e511da`.
- Publicação consolidada: `5250dbb`.
- Edição de veículos PRO com nova aprovação: `a83a3f3`.
