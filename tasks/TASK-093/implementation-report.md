# Implementation Report — TASK-093

TASK: TASK-093  
STATUS: READY_FOR_QA  
OWNER: MAZZI Dev  
LAST_UPDATED: 2026-09-09

## 1. O que foi implementado

- Criado o registro canônico local do Termo de Adesão, Uso e Conduta do Profissional MAZZI v2/2.0, com texto integral, hash SHA-256 estável e placeholders jurídicos explícitos.
- Criado visualizador mobile-first no PRO com leitura integral, versão, status/data do aceite, histórico, checkbox desmarcado por padrão e CTA bloqueado até o aceite explícito.
- O aceite passa pela RPC server-side existente; o frontend não escolhe status, data, hash ou versão válida.
- Aceite com falha permanece aberto e exibe erro; o modal só fecha após confirmação positiva do backend.
- O histórico v1 foi preservado e a versão corrente v2 passou a ser exibida no catálogo de compliance.
- App Aluno não recebeu alteração funcional desta task.

## 2. Arquivos criados ou alterados

- `src/domain/professional-terms.ts`
- `src/components/provider/ProfessionalTermsViewer.tsx`
- `src/types/index.ts`
- `src/lib/db-service.ts`
- `src/apps/provider/ProviderApp.tsx`
- `src/apps/provider/components/ProviderManagementTab.tsx`
- `src/domain/compliance.ts`
- `src/domain/status-presentation.ts`
- `tests/professional-terms.test.ts`
- `tests/provider-compliance-flow.test.ts`
- `tests/providers-compliance.test.ts`
- `tests/task-077a-admin-hardening.test.ts`
- `tests/task-096a4m-r12a-baseline.test.ts`
- `docs/10-compliance.md`
- `supabase/baseline-candidate/mazzi_mvp_baseline_schema.sql`
- `supabase/baseline-candidate/mazzi_mvp_baseline_reference_data.sql`
- `tasks/TASK-093/requirement.md`
- `tasks/TASK-093/technical-plan.md`

## 3. Migrations criadas e aplicadas

- `supabase/migrations/20260909220001_versioned_professional_terms.sql`
  - Adiciona `terms_version`, `document_hash` e `accepted_at`.
  - Preserva aceites existentes, derivando v1 do caminho legado e mantendo a data histórica.
  - Publica `v2`, recria a RPC de aceite com versionamento/hash server-side e atualiza o gate de ativação.
  - Não faz downgrade em massa de providers ativos.
- `supabase/migrations/20260909220730_update_professional_terms_requirement.sql`
  - Atualiza o requisito de catálogo remoto para o termo v2.

Ambas foram aplicadas no Supabase DEV `bhvpkgonhlujmxvwnxix`. O ledger remoto confirmou os timestamps `20260909220001` e `20260909220730`.

## 4. Decisões técnicas

- Uma única tabela existente (`compliance_documents`) continua sendo a fonte do histórico; não foi criado sistema paralelo.
- A autoridade do conteúdo é dividida de forma determinística: texto/hash no bundle versionado e validade do aceite no backend.
- `is_provider_owner` existente continua controlando instrutor e identidade autorizada de autoescola; não foi aberta autorização anônima.
- Dados empresariais permanecem placeholders em DEV com marcador `LEGAL_ENTITY_DETAILS_REQUIRED_FOR_PRODUCTION`.
- A migration local foi renomeada para os timestamps efetivamente registrados pelo executor remoto, evitando divergência entre diretório e ledger.

## 5. Desvios do technical plan

- Foi necessária uma segunda migration de catálogo porque o schema DEV usa `compliance_requirements.document_type` como `varchar` e não possui `updated_at`; a migration foi ajustada sem alterar o modelo nem os dados históricos.
- O callback de aceite foi alterado para retornar sucesso explícito, impedindo o fechamento do visualizador quando a persistência falha.

## 6. Testes automatizados adicionados/atualizados

- Hash e conteúdo integral v2, placeholders e marcador jurídico.
- Checkbox/CTA/ARIA do visualizador.
- RPC versionada, hash e proteção contra downgrade em massa.
- Catálogo de compliance e baseline v2.
- Fluxo de compliance no PRO e projeção administrativa com novos metadados.

## 7. Resultados dos portões

- **Lint**: `npm run lint` — aprovado, 0 erros.
- **Testes focados da TASK-093**: aprovado, 67 testes passando nos arquivos de termos, compliance, baseline e hardening administrativo.
- **Build Student**: aprovado.
- **Build Instructor/PRO**: aprovado.
- **Build Admin**: aprovado.
- **Build Landing**: aprovado.
- **Build completo**: `npm run build:all` — aprovado.
- **Suíte global**: ainda possui falhas fora desta task em `map-follow-provider`, `instant-lesson-category` e no teste live de cancelamento RPC. Os contratos que passaram a incluir os metadados de termos foram atualizados e ficaram verdes; as falhas remanescentes são registradas no QA.

## 8. Testes manuais

Não foi executado E2E real no Chromium nesta etapa porque o workspace não possui `@playwright/test`/Playwright instalado como dependência. A validação disponível foi estática, automatizada, de build e direta no banco DEV.

## 9. Limitações e riscos

- O texto contratual ainda exige revisão jurídica.
- Placeholders de pessoa jurídica não podem chegar à produção.
- A versão v1 permanece preservada como aceite histórico; o repositório não continha o texto integral original v1 para reconstrução sem inventar conteúdo.
- A suíte global precisa ser saneada antes de uma liberação formal.

## 10. Handoff para QA

Validar AC01–AC12, especialmente checkbox desmarcado, retry com erro, aceite por instrutor e SCHOOL_ADMIN autorizado, rejeição de versão não corrente, preservação do registro v1, consulta do histórico e responsividade 375/390/430px. Conferir novamente o ledger DEV e não executar migration em produção.
