# MAZZI — TASK-096A4M-R5 Walkthrough

## Estado vigente após R12

R10, R10D, R11 e R11A: PASS. DEV alinhado, Production inalterada e consolidação Git aguardando autorização explícita de commit.

## TASK-096A4M-R12A — baseline candidato

1. Reconciliado o schema candidato com os contratos atuais de R10D e R11.
2. Mantido o requisito canônico de termos como referência não-PII.
3. Comparados estaticamente os helpers/trigger de termos, ativação e lifecycle com as migrations canônicas.
4. Validado o conjunto canônico de enums de compliance e veículos; ocorrências de
   `PENDING_REVIEW`/`DECLINED` fora desses enums permanecem em domínios válidos.
5. Nenhuma mutation foi executada no Supabase DEV; nenhum commit, push ou deploy foi feito.

## Fluxo auditado

1. Capturados branch, HEAD, status, CI, apps e migrations locais.
2. Confirmado acesso read-only ao Supabase LIVE.
3. Leitura anônima de `compliance_documents` negada.
4. Leitura autenticada pelo Admin permitida.
5. Invocadas somente RPCs read-only de compliance/eligibilidade.
6. Consultado o bucket esperado sem upload ou alteração: ausente.
7. Verificados previews Vercel existentes: Student, PRO e Admin em `READY`/`Preview`.
8. Consultado GitHub Actions: último CI conhecido no SHA remoto `3b5b0817d62a96ba2d1cf23cb92ed1cfe74e6f0e` passou; o HEAD local não foi enviado nesta task.
9. Executados targeted tests, suíte completa, lint, builds e diff check.

## TASK-096A4M-R6

1. Mantido o bucket privado e o caminho de upload já usado pelo frontend.
2. Criada a migration forward-only `20260825120000_task_096a4m_r6_provider_compliance_storage.sql`.
3. Reconciliadas apenas as policies históricas conhecidas do bucket e criadas policies R6 com ownership, reviewer e delete escopados.
4. Criado teste estático sem credenciais reais ou mutações LIVE.
5. Nenhuma migration foi aplicada no LIVE.

## Resultado

- Código local: compatível com os contratos revisados.
- LIVE: bucket ainda ausente; publicação não executada por regra da task.
- Local: migration e teste R6 preparados para publicação futura.
- Migrations: não publicadas.
- Production: intocada.
- Git commit/push: não realizados.

## Evidência Vercel

Previews mais recentes observados pelo CLI, todos `READY` e `Preview`:

- Student: `mazzi-app-beta-7p7o0xczi-lucas-haro-8688s-projects.vercel.app`
- PRO: `mazzi-pro-beta-h0zvmd0mp-lucas-haro-8688s-projects.vercel.app`
- Admin: `mazzi-admin-beta-qq532lyh6-lucas-haro-8688s-projects.vercel.app`

O `inspect` não forneceu SHA Git no endpoint usado; por isso a correspondência exata com o HEAD local não foi afirmada.

## R9 — preflight de publicação

O bucket privado existe no LIVE, porém R6 e R8 estão ausentes do ledger. O enum LIVE ainda não possui `IN_REVIEW`. As policies atuais são privadas e as RPCs de compliance estão restritas a `authenticated`.

Somente metadados e contagens agregadas foram consultados; nenhum documento foi lido. O LIVE não foi mutado. A publicação deve aguardar a reconciliação da divergência R6/bucket e seguir R6, R8 enum e R8 canonicalização.

## R10A — publicação de compliance e revisão de veículos

Após preflight read-only, as migrations foram aplicadas no LIVE `bhvpkgonhlujmxvwnxix` em ordem R6 → R8A → R8B → R10A veículo. O bucket privado e as policies foram preservados. Os status operacionais usam `PENDING`, `IN_REVIEW`, `REJECTED` e `APPROVED`; `provider.status` continua separado. Veículos legados foram normalizados sem apagar histórico e novas gravações fora do contrato canônico foram bloqueadas. Não houve upload, leitura de documento, alteração de `spatial_ref_sys`, commit, push, CI ou deploy.

## R10B — preflight e bloqueio seguro

O Git foi reconciliado por fast-forward para `3b5b0817d62a96ba2d1cf23cb92ed1cfe74e6f0e`, e as alterações locais foram restauradas sem conflito. A causa do provider DRAFT foi localizada no escopo consultado pelo helper de compliance. As migrations R10B foram preparadas, mas o fresh rebuild local não pôde ser executado por falta de Docker/runtime; por isso nenhum novo DDL foi enviado ao LIVE.

## R10B — execução direta no DEV

1. Confirmado o baseline Git e preservados worktree, `supabase/baseline-candidate/` e stash de segurança.
2. Revisadas as migrations R10B; tentativas transacionais com erro foram revertidas e corrigidas antes da aplicação válida.
3. Aplicada a reconstrução controlada dos enums canônicos, preservando defaults, views, policies, grants e assinaturas das funções.
4. Aplicado o helper de elegibilidade com compatibilidade `USER_GLOBAL` + próprio `PROVIDER`, trigger de ativação após aprovação final e backfill restrito a DRAFT/PENDING_REVIEW elegíveis.
5. Aplicada a reconciliação do helper legado usado pelas consultas públicas/ofertas.
6. Validado diretamente no DEV: enums canônicos, zero linhas legadas, provider DRAFT elegível promovido, zero elegíveis não-ativos, funções sem produção de status removido, Storage privado e policies escopadas.
7. Executados targeted tests=42 passed, `npm test`=717 passed/0 skipped/0 failed, lint, builds e diff-check.

Não houve reset local, consulta de documentos, signed URL, commit, push, deploy, alteração de Production ou alteração de `spatial_ref_sys`. A busca textual foi concluída sem ocorrências do status removido.

## R10C — fechamento

1. Criada e aplicada no DEV a migration `20260825145519_fix_instructor_auto_activation_scope`.
2. O trigger passou a separar candidatos por escopo: todos os providers do usuário em `USER_GLOBAL`, ou somente o provider do documento em `PROVIDER`.
3. A auditoria passou a registrar o status anterior capturado antes da promoção.
4. O ledger foi alinhado administrativamente, mantendo os mesmos números de versão.
5. Migrations históricas, filenames, testes e documentação foram normalizados para o contrato canônico.
6. Busca textual do status removido: zero ocorrências.
7. Targeted=41 passed; full suite=716 passed/0 skipped/0 failed; lint, builds e diff-check PASS.

## R10D — gate de termos

1. Confirmado que o requisito obrigatório de termos estava com escopo nulo e que 56 INSTRUCTOR ACTIVE não tinham aceite vigente.
2. Aplicada a migration `20260825151539_enforce_current_mazzi_terms_for_instructor_activation` no DEV.
3. O backend passou a fixar `v1`, rejeitar versões arbitrárias e aceitar somente o provider/owner correto.
4. A elegibilidade passou a exigir termos PROVIDER atuais além dos requisitos pessoais.
5. Providers ativos sem aceite foram rebaixados para DRAFT sem fabricar aceitação; aceites existentes foram preservados.
6. Cenários transacionais de termos primeiro, compliance depois, versão inválida e retry passaram com rollback.
7. Estado final: INSTRUCTOR ACTIVE=5, DRAFT=56, DRIVING_SCHOOL ACTIVE=12, ACTIVE sem termos=0.

## R11 — ciclo de vida de ofertas

1. O preflight no DEV encontrou 58 ofertas efetivamente ativas vinculadas a providers INSTRUCTOR em DRAFT.
2. A migration `20260825172601_enforce_provider_offering_lifecycle_consistency` foi aplicada forward-only e o backfill tornou essas ofertas `INACTIVE` com `is_active=false`.
3. O trigger desativa ofertas na transição do provider para qualquer estado não ACTIVE, na mesma transação.
4. A transição de volta para ACTIVE não reativa ofertas; o smoke transacional confirmou 0 ofertas ativas após a reativação e foi revertido com rollback.
5. A validação final encontrou 0 inconsistências e 50 ofertas efetivamente ativas pertencentes a providers ACTIVE.
6. Os gates de busca, slots, quote e salvamento de oferta foram preservados, assim como `OFFERING_PROVIDER_NOT_ACTIVE`.
7. Targeted=59 passed; lint, builds e diff-check PASS. A suíte completa teve 722 passed e 1 falha remota preexistente de exclusão de bookings; nenhuma alteração foi feita nessa fixture.

## R11A — isolamento do teste remoto

1. A fixture vazada c007/c008 foi removida exclusivamente por seus IDs.
2. O teste passou a gerar IDs aleatórios e selecionar um offering único com provider, veículo e instrutor coerentes.
3. O intervalo passado é escolhido dinamicamente entre candidatos livres para o aluno e sempre termina antes de `NOW()`.
4. Os dois inserts ocorrem em uma transação; qualquer falha executa rollback antes de propagar o erro.
5. O cleanup remove apenas audit logs e bookings dos IDs da execução, inclusive em falhas.
6. Foram realizadas três execuções consecutivas: 5/5 em cada; nenhuma fixture permaneceu no DEV.
7. Suíte completa: 724 passed, 0 skipped, 0 failed. R11 e R10D permaneceram íntegros.
