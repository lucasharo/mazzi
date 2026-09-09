# Technical Plan — TASK-093

TASK: TASK-093
STATUS: TECH_READY
OWNER: MAZZI Tech Lead
LAST_UPDATED: 2026-09-09

## 1. Resumo Técnico

Evoluir o compliance existente, sem criar uma segunda tabela de termos.
Adicionar ao `compliance_documents` os metadados canônicos do aceite (`terms_version`
e `document_hash`; `created_at` permanece a evidência de `accepted_at`), atualizar
o RPC de aceite para aceitar somente a versão corrente e retornar esses campos,
e manter os registros históricos por linha.

O conteúdo integral de cada versão viverá em um módulo TypeScript versionado e
imutável. A UI usará um visualizador reutilizável dentro do PRO, com resumo,
leitura completa, checkbox explícito e consulta posterior.

## 2. Código Existente Relacionado

- `src/domain/compliance.ts`: catálogo e elegibilidade atuais.
- `src/lib/db-service.ts`: `mapComplianceFromDb`, leitura e RPC de aceite.
- `src/apps/provider/components/ProviderManagementTab.tsx`: card atual de
  compliance e CTA de aceite.
- `src/apps/provider/components/ProviderProfileTab.tsx`: Perfil e status.
- `src/apps/provider/ProviderApp.tsx`: carregamento do workspace e callbacks.
- `supabase/migrations/20260825151539_enforce_current_mazzi_terms_for_instructor_activation.sql`:
  versão atual `v1`, RPC, gate e segurança.
- `supabase/baseline-candidate/`: baseline a atualizar caso o schema mude.

## 3. Arquivos Provavelmente Afetados

- `[NEW]` `src/domain/professional-terms.ts` — registry imutável v1/v2, texto,
  resumo e hash canônico.
- `[NEW]` `src/components/provider/ProfessionalTermsViewer.tsx` — leitura
  mobile-first e aceite explícito.
- `[MODIFY]` `src/types/index.ts` — metadados de versão/hash/aceite.
- `[MODIFY]` `src/lib/db-service.ts` — projeção de metadados e RPC/listagem.
- `[MODIFY]` `src/apps/provider/components/ProviderManagementTab.tsx` — resumo,
  visualizador, status atual e histórico.
- `[MODIFY]` `src/apps/provider/components/ProviderProfileTab.tsx` — consulta
  posterior em Perfil/Gestão.
- `[MODIFY]` `src/apps/provider/ProviderApp.tsx` — carregar aceite/histórico e
  persistir após confirmação.
- `[NEW]` `supabase/migrations/20260909220001_versioned_professional_terms.sql`.
- `[NEW]` `supabase/migrations/20260909220730_update_professional_terms_requirement.sql`.
- `[MODIFY]` `supabase/baseline-candidate/mazzi_mvp_baseline_schema.sql` e/ou
  referência de dados, se o baseline canônico exigir as novas colunas/RPC.
- `[NEW/MODIFY]` testes de domínio, UI, RPC-contract e segurança.
- `[NEW]` `tasks/TASK-093/implementation-report.md`, `qa-report.md` e
  `final-review.md` durante as etapas correspondentes.

## 4. Banco de Dados & Migrations

Migration forward-only e idempotente quando aplicável:

1. `ALTER TABLE public.compliance_documents ADD COLUMN IF NOT EXISTS terms_version text`.
2. `ADD COLUMN IF NOT EXISTS document_hash text`.
3. Checks restritos aos aceites: versão/hash não podem ser vazios quando o tipo
   for `MAZZI_TERMS_ACCEPTANCE`; documentos não-termos permanecem compatíveis.
4. Recriar `current_mazzi_terms_version()` para retornar `v2`.
5. Recriar `provider_accept_mazzi_terms(uuid,text)` preservando `SECURITY DEFINER`,
   `search_path`, ownership, usuário ativo, grant somente `authenticated` e
   idempotência. O hash será calculado por autoridade única do banco a partir do
   hash esperado da versão canônica registrada na migration, não pelo frontend.
6. Preservar aceites `v1`; não atualizar linhas históricas para `v2`.
7. `is_provider_activation_eligible()` deve consultar versão corrente e não
   aceitar somente uma versão antiga.
8. Registrar `terms_version` no `audit_logs` e manter `created_at` como
   `accepted_at`.

Antes de aplicar, conferir que o migration ledger remoto está reconciliado. Após
aplicar, verificar ledger, função, grants, constraints e contagem histórica sem
expor PII.

## 5. RLS e RBAC Afetados

- Não abrir tabela ou função para `anon`.
- Aceite continua protegido por `auth.uid()` e ownership do provider.
- Consulta do próprio histórico deve ser via RPC ou leitura já protegida; Admin
  mantém somente as permissões existentes.
- SCHOOL_STAFF não ganha autorização nova automaticamente.
- Não confiar em `user_metadata`, provider id enviado pelo browser ou hash
  enviado pelo cliente.
- A referência ao conteúdo é pública no bundle, mas o registro de aceite continua
  protegido por RLS/RPC.

## 6. Estratégia de Implementação

1. Criar `requirement.md` e manter este plano como handoff aprovado.
2. Auditar schema, RPC, baseline, tipos e fluxos atuais.
3. Criar registry canônico v2 e teste de hash estável; preservar representação
   mínima compatível da v1 para histórico.
4. Criar migration forward-only e atualizar tipos do banco/mapas.
5. Implementar visualizador/aceite reutilizável com estados loading, error,
   success, disabled, foco e viewport mobile.
6. Integrar Management/Profile sem remover o card atual nem misturar Student.
7. Criar testes negativos de versão, ownership, anon, retry e histórico.
8. Aplicar migration no DEV e validar diretamente o banco.
9. Executar QA adversarial, corrigir regressões e produzir os artefatos do fluxo.

## 7. Ordem de Implementação

1. Registry canônico e tipos.
2. Migration/RPC e baseline.
3. Serviço de leitura/aceite.
4. Viewer e panel de aceite.
5. Integração no PRO.
6. Testes automatizados.
7. DEV migration + verificação.
8. Full gates e QA manual.

## 8. Testes Obrigatórios

- Registry: v2, conteúdo, hash estável e placeholders.
- RPC contract: current version, wrong version, ownership, active user,
  idempotência, histórico v1.
- UI: abrir/voltar, checkbox desmarcado, CTA bloqueado, aceite confirmado,
  erro, status/histórico no Perfil, refresh.
- Segurança: anon, usuário cruzado, role não autorizada, sem forge de timestamp
  ou hash.
- Multi-role: Student preservado; Instructor e School Admin autorizados.
- Responsividade/acessibilidade em 375/390/430px.
- Regressão de compliance/lifecycle existente.

## 9. Riscos e Mitigações

- **Ativação em massa:** verificar estratégia no DEV e não fazer backfill de
  `v2` em aceites `v1`.
- **Hash divergente:** uma autoridade única (hash fixo registrado no backend e
  registry testado) e comparação automatizada.
- **Placeholders em produção:** marcador e teste explícitos.
- **Documento longo:** viewer com scroll natural, headings e navegação clara.
- **Mudanças locais não relacionadas:** não resetar nem sobrescrever working tree;
  alterações da TASK ficam isoladas nos arquivos necessários.

## 10. O que NÃO Alterar

- Regras de localização/privacidade do aluno.
- Pagamentos e gateways reais.
- RLS de outros domínios.
- Lifecycle de booking, veículo, oferta e notificações, salvo integração direta
  do gate de termos.
- Aceites históricos ou migrations já aplicadas.
- Production ou qualquer projeto Supabase diferente do DEV informado.

## 11. Instruções para o MAZZI Dev

Implementar somente este plano. Não inventar dados empresariais. Usar os
componentes MAZZI existentes, ícones SVG, touch targets mínimos de 44px e
feedback assíncrono por ação. Antes de declarar READY_FOR_QA, aplicar a migration
no DEV autorizado, comprovar o ledger remoto e registrar testes/lint/build,
incluindo limitações concretas se algum gate ambiental falhar.
