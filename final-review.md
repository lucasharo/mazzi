# MAZZI — TASK-096A4M-R5 Final Review

## Estado vigente após R12

R10, R10D, R11 e R11A estão PASS. O Supabase DEV está alinhado ao ledger local. A consolidação Git está pronta para revisão, mas commit, push e deploy permanecem pendentes de autorização. Os bloqueios descritos em seções históricas foram superados.

## TASK-096A4M-R12A — decisão de baseline

**READY FOR COMMIT REVIEW**. O baseline candidato foi alinhado aos contratos canônicos
de R10D e R11, incluindo termos atuais, gate de ativação e desativação de ofertas na
transição de provider. A comparação estática com as migrations canônicas passou.

Não houve mutation, aplicação de migration, alteração no Supabase DEV, commit, push,
deploy ou alteração em Production.

## Decisão

**PASS (preparação local) / NO-GO para publicação LIVE nesta task**.

## Findings

### F-01 — DEPENDÊNCIA DE PUBLICAÇÃO — bucket de compliance ausente no LIVE

O bucket `provider-compliance-docs` usado pelo código e previsto na migration histórica não foi encontrado no Supabase LIVE. A migration forward-only R6 foi criada para provisioná-lo, mas não foi aplicada.

### F-02 — RISCO ALTO — ledger/assinaturas LIVE não auditáveis pelo canal público

Não foi possível confirmar o ledger de migrations nem as assinaturas exatas de RPC sem acesso privilegiado de metadados. Nenhuma chave service role foi usada para contornar essa limitação.

### F-03 — COMPATÍVEL — leitura Admin

A leitura autenticada de `compliance_documents` pelo Admin respondeu HTTP 200. A aplicação local usa projeção explícita e não expõe `storage_path`.

### F-04 — COMPATÍVEL — RPCs read-only de compliance

As RPCs `list_my_global_compliance`, `is_instructor_global_compliance_valid`, `is_membership_compliance_valid` e `is_provider_instructor_eligible` responderam no LIVE com sessão autenticada.

## R6 — migration local revisada

`supabase/migrations/20260825120000_task_096a4m_r6_provider_compliance_storage.sql`
é idempotente no bucket, mantém privacidade, restringe MIME/tamanho, valida o
prefixo do provider com `auth.uid()` indiretamente via `is_provider_owner()`,
permite leitura de owner/reviewer, exclusão escopada e nenhum UPDATE de cliente.
Não altera `compliance_documents` nem expõe `storage_path`.

## Próxima ação segura

Aplicar a migration R6 apenas em task futura explicitamente autorizada, com
validação de existência, privacidade e upload autenticado. Não reaplicar
migrations históricas sem reconciliar o ledger.

## Integridade do worktree

Alterações preexistentes foram preservadas. Esta auditoria não fez commit, push, deploy ou alteração de código de aplicação.

## TASK-096A4M-R9 — preflight read-only

Status: **PARTIAL / NO-GO para publicação imediata**.

O bucket privado já existe no LIVE, mas R6 e R8 estão ausentes do ledger. O enum ainda não possui `IN_REVIEW` e mantém os valores anteriores/`EXPIRED`. Contagem agregada: `APPROVED=236`, `REJECTED=1`, sem dados antigos encontrados.

Ordem futura: reconciliar R6/bucket → adicionar `IN_REVIEW` → canonicalizar dados, constraint, policies e RPCs. LIVE não foi alterado.

Supabase LIVE consulted: YES (read-only)
Supabase LIVE changed: NO
Service role: NO
Documents exposed: NO
Commit/push/deploy: NÃO realizados.

Queries read-only: ledger, `information_schema.columns`, `pg_type/pg_enum`, `pg_constraint`, `pg_policies`, `pg_proc/has_function_privilege`, `storage.buckets` e contagem agregada por status. O CLI local do Supabase não está disponível.

Risco adicional informado pelo advisor: `public.spatial_ref_sys` está com RLS desabilitado; permanece fora do escopo e sem alteração.

## R10A — resultado

Publicação LIVE concluída em ordem controlada: R6, R8A, R8B e R10A de veículos. O bucket existente foi reconciliado sem recriação ou exclusão. `IN_REVIEW` foi adicionado e os fluxos passaram ao contrato canônico. Compliance: APPROVED=236, REJECTED=1. Veículos: ACTIVE=97. Nenhum documento foi exposto, `spatial_ref_sys` não foi alterado, e não houve commit/push/deploy.

## R10B — histórico de preflight superado

O provider INSTRUCTOR DRAFT com seis documentos PROVIDER APPROVED foi identificado como falso negativo do helper USER_GLOBAL-only. As migrations novas de remoção física do enum e promoção automática estão locais, mas não foram aplicadas no LIVE. O gate obrigatório de fresh rebuild falhou por ausência do Docker/runtime local. LIVE, provider, `spatial_ref_sys`, commit, push e deploy permaneceram inalterados.

## R10B — retomada no DEV

O bloqueio acima foi cancelado pela instrução de retomada: Docker, Supabase local e fresh rebuild deixaram de ser gates. As migrations foram aplicadas somente no Supabase DEV `bhvpkgonhlujmxvwnxix`, de forma forward-only e transacional.

Resultado: o status legado foi removido fisicamente dos enums `compliance_status` e `vehicle_status`; `IN_REVIEW` é o valor canônico de análise. A elegibilidade passou a aceitar `USER_GLOBAL` ou o próprio escopo `PROVIDER`, o provider INSTRUCTOR DRAFT elegível foi promovido a ACTIVE, e a aprovação do último requisito dispara promoção automática apenas para DRAFT/PENDING_REVIEW. SUSPENDED/BLOCKED/REJECTED não são promovidos.

Ledger DEV: `20260825143810 remove_legacy_review_enum_values_v2`, `20260825143844 activate_eligible_instructor_providers_v2`, `20260825143954 reconcile_instructor_compliance_scope_v2`. Status pós-validação: INSTRUCTOR ACTIVE=61, DRIVING_SCHOOL ACTIVE=12, eligible INSTRUCTOR não-ativos=0; linhas com status removido=0.

Testes locais: targeted=42 passed; full suite=717 passed, 0 skipped, 0 failed; lint/builds/diff-check PASS. Não houve commit, push, deploy, alteração de Production, documentos lidos, URLs assinadas ou alteração de `spatial_ref_sys`. O working tree, baseline-candidate e stash de segurança foram preservados.

Limitação anterior encerrada: migrations, docs e testes locais foram normalizados para o contrato canônico; nomes do ledger DEV foram alinhados sem alterar versões.

## R10C — resultado

O trigger de compliance agora suporta ativação universal para documentos `USER_GLOBAL` e `PROVIDER`, mantendo `is_provider_activation_eligible()` como autoridade. O audit registra `DRAFT` ou `PENDING_REVIEW` conforme o estado real anterior. A migration `20260825145519_fix_instructor_auto_activation_scope` foi aplicada no DEV.

O inventário textual foi encerrado: zero ocorrências do status removido em código, testes, migrations, documentação e baseline auditado. Os nomes no ledger DEV e os filenames locais estão alinhados; versões permaneceram inalteradas.

Full suite: 716 passed, 0 skipped, 0 failed. Targeted: 41 passed. Lint, Student/PRO/Admin builds e diff-check: PASS. Commit, push, deploy e Production: não realizados.

## R10D — resultado

O requisito obrigatório de termos foi normalizado para `PROVIDER`. A versão `v1` agora é definida por helper server-side e a RPC rejeita versões arbitrárias. O helper de elegibilidade exige termos vigentes além dos requisitos pessoais; a aceitação pertence ao próprio provider e owner.

Os 56 INSTRUCTOR ACTIVE sem aceite foram rebaixados para DRAFT sem criação de documentos artificiais. O DEV terminou com INSTRUCTOR ACTIVE=5, INSTRUCTOR DRAFT=56, DRIVING_SCHOOL ACTIVE=12 e ACTIVE sem termos=0. Testes transacionais de versão inválida, ordem de aceitação, ativação e idempotência usaram rollback.

Migration: `20260825151539_enforce_current_mazzi_terms_for_instructor_activation.sql`. Targeted=45 passed; full suite=720 passed, 0 skipped, 0 failed; lint, builds e diff-check PASS. Commit, push, deploy e Production: não realizados.

## R11 — resultado

A migration `20260825172601_enforce_provider_offering_lifecycle_consistency` foi aplicada somente no Supabase DEV. O backfill corrigiu 58 ofertas efetivamente ativas de providers INSTRUCTOR em DRAFT, sem tocar ofertas de providers ACTIVE. O trigger agora desativa ofertas quando o provider sai de ACTIVE e não as reativa automaticamente quando retorna.

O invariante ficou íntegro: 0 ofertas efetivamente ativas pertencem a provider não ACTIVE e 50 permanecem em providers ACTIVE. O smoke transacional com rollback confirmou ACTIVE→DRAFT=0 ofertas ativas e reativação sem auto-reativação. Gates públicos e `OFFERING_PROVIDER_NOT_ACTIVE` foram preservados. Storage, `spatial_ref_sys`, Production e demais escopos ficaram inalterados.

Testes direcionados: 59 passed. Lint, builds Student/PRO/Admin e diff-check: PASS. A suíte completa registrou 722 passed e 1 failed por conflito de exclusão de bookings na fixture remota preexistente `rpc-cancellation-v2-real.test.ts`; não foi alterado nesta task. Commit, push e deploy: não realizados.

## R11A — resultado

O teste remoto de cancelamento foi isolado sem alterar a constraint, a RPC ou a migration R11. A fixture usa UUIDs dinâmicos, contexto coerente de offering/provider/vehicle/instructor, slot passado livre e transação atômica. O cleanup é limitado aos IDs criados e protegido por `finally`.

O stale c007/c008 foi removido por ID, sem remoção de dados reais. Três execuções consecutivas passaram com 5/5 testes; a suíte completa passou com 724 passed, 0 skipped e 0 failed. O helper de failure-safety confirmou rollback quando o segundo insert falha. Lint, builds e diff-check passaram. DEV teve apenas DML de fixtures; schema, Storage, `spatial_ref_sys`, Production, commit, push e deploy permaneceram inalterados.
