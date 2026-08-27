# Technical Plan — TASK-078

TASK: TASK-078
STATUS: TECH_READY
OWNER: MAZZI Tech Lead
LAST_UPDATED: 2026-08-26

## Resumo Técnico

O Admin será alinhado ao sistema visual compartilhado do MAZZI, sem criar uma terceira identidade visual. A implementação reutilizará as primitivas `Button`, `Input`, `Select`, `Modal`, `ModalActionFooter`, `StatusBadge`, `Toast`, `EmptyState`, `ContentSkeleton`, `NotificationIndicator` e os tokens `--mazzi-*` já consumidos pelos apps Aluno e PRO. A skill `ui-ux-pro-max` foi usada para orientar densidade operacional, adaptação de tabelas em mobile, preservação de conteúdo durante revalidação e feedback acessível; cores e tipografia continuarão as do MAZZI.

A auditoria read-only no Supabase DEV confirmou os domínios reais: `provider_status` (`DRAFT`, `PENDING_REVIEW`, `ACTIVE`, `SUSPENDED`, `BLOCKED`, `REJECTED`), `compliance_status` (`PENDING`, `IN_REVIEW`, `APPROVED`, `REJECTED`, `EXPIRED`), `vehicle_status` (`DRAFT`, `PENDING`, `IN_REVIEW`, `ACTIVE`, `INACTIVE`, `EXPIRED`, `BLOCKED`), `booking_status`, `payment_status`, `payout_status` e `user_role` (`STUDENT`, `INSTRUCTOR`, `DRIVING_SCHOOL`, `SCHOOL_ADMIN`, `SCHOOL_STAFF`, `PLATFORM_ADMIN`, `SUPPORT`).

O banco confirma que `update_admin_platform_configurations(jsonb)` é a escrita transacional com RBAC/auditoria. A tela precisa enviar somente chaves aceitas e refletir o resultado persistido. O RPC legada `admin_update_user_role` altera a role primária e remove a anterior, portanto não será usado para adicionar Admin/Suporte: será criada uma operação multi-role própria, segura, idempotente e auditável.

## Código Existente Relacionado

- `src/apps/admin/AdminApp.tsx`: hidratação, ações administrativas, navegação e refresh.
- `src/apps/admin/AdminComponents.tsx`: tabs administrativas, filtros, cards, formulários e tabelas.
- `src/lib/db-service.ts`: contratos de leitura/escrita com Supabase.
- `src/types/index.ts`: tipos de Admin, documentos e roles.
- `src/components/ui/StatusBadge.tsx`, `Toast.tsx`, `Modal.tsx`, `ModalActionFooter.tsx`, `EmptyState.tsx`, `ContentSkeleton.tsx`: padrões compartilhados a preservar e ampliar.
- `src/domain/compliance.ts`, `src/domain/platform-config.ts`, `src/domain/rbac.ts`: regras e dados de domínio existentes.
- `supabase/migrations/20260822033624_admin_platform_config_write_rpc.sql` e `20260822133721_admin_provider_and_role_operations.sql`: contratos existentes de configurações e roles.

## Arquivos Afetados

- [MODIFY] `src/apps/admin/AdminApp.tsx`
- [MODIFY] `src/apps/admin/AdminComponents.tsx`
- [MODIFY] `src/lib/db-service.ts`
- [MODIFY] `src/types/index.ts` quando o contrato real requerer extensão tipada
- [MODIFY] `src/components/ui/StatusBadge.tsx`
- [NEW] `src/domain/status-presentation.ts`
- [NEW] componentes compartilhados mínimos para cartões/feedback administrativo, somente se as primitivas atuais não cobrirem o caso
- [NEW] `supabase/migrations/<timestamp>_admin_governance_multi_role.sql`
- [NEW] `supabase/functions/admin-invite-administrative-user/index.ts` e arquivos de suporte estritamente necessários
- [NEW/MODIFY] testes de contrato de status, Admin UI, viewer, refresh, settings e RBAC multi-role
- [MODIFY] `supabase/baseline-candidate/` apenas se uma migration/RPC nova for criada
- [NEW] `tasks/TASK-078/implementation-report.md`, `qa-report.md`, `final-review.md`

## Banco de Dados & Migrations Afetadas

Será criada apenas uma migration forward-only caso a implementação de multi-role/invite exigir o contrato persistente. Ela deverá:

1. Criar RPC autenticada para um `PLATFORM_ADMIN` acrescentar exclusivamente `PLATFORM_ADMIN` ou `SUPPORT` a uma identidade existente, sem substituir `users.role` nem remover roles atuais.
2. Ser idempotente por `(user_id, role)`, registrar `audit_logs` e rejeitar solicitante não autorizado, autoelevação e remoção/demissão do último administrador.
3. Criar, se necessário para convite de identidade ainda inexistente, uma tabela/registro de convite mínimo e protegido que seja consumido exclusivamente pelo backend/Edge Function. Não haverá papel confiado em `user_metadata`.
4. Manter RLS habilitada e grants mínimos. Funções SECURITY DEFINER terão `search_path` seguro, verificações explícitas e `EXECUTE` apenas para as roles indispensáveis.

O viewer de compliance não requer tornar storage público: o bucket `provider-compliance-docs` já é privado, aceita PDF/JPEG/PNG/WebP e possui política de leitura para reviewer. O cliente solicitará URL assinada de vida curta pela API de Storage, sujeita ao RLS existente.

## RLS e RBAC Afetados

- Nenhuma chave service role será adicionada ao frontend.
- Documentos serão acessados somente por sessão autenticada autorizada; não haverá URL pública nem exposição de caminho na UX principal.
- `PLATFORM_ADMIN` é a única role apta a salvar configurações e adicionar papel administrativo.
- `SUPPORT` mantém acesso limitado e não pode conceder/elevAR roles.
- Operações de convite serão autenticadas no Edge Function, validarão o JWT do chamador antes de qualquer ação privilegiada e usarão segredo apenas no servidor, nunca no browser.
- A migration incluirá testes/garantias para preservar ao menos um administrador de plataforma ativo.

## Estratégia de Implementação

1. Criar um mapper único de apresentação para status/documentos. Ele receberá domínio explícito, retornará label, variante e texto de fallback amigável, e será adotado no `StatusBadge` e Admin.
2. Corrigir todos os filtros/selects do Admin para refletir os enums auditados. `Todos` será filtro, nunca transição. Ações continuarão limitadas às transições existentes nas RPCs.
3. Reestruturar visualmente dashboard/tabs/listas com tokens MAZZI, componentes compartilhados, cards responsivos e texto em português; remover índigo/slate como identidade e todos os valores técnicos da informação principal.
4. Trocar o refresh por stale-while-revalidate: skeleton só em carga sem dados; durante refresh conteúdo permanece e apenas o ícone gira; erros usam toast/banner amigável preservando dados.
5. Remover `alert()` e centralizar retorno de ações em `ToastContainer` e tradutor de erros de infraestrutura.
6. Incluir viewer seguro de compliance (imagem/PDF), com estado de carregamento/erro, URL curta, metadados amigáveis e sem paths/UUIDs na experiência principal.
7. Corrigir configurações para montar o payload permitido, tratar respostas/erros da RPC existente e atualizar estado pelo retorno persistido.
8. Implementar a governança de roles no banco e Edge Function; substituir a UI que troca papel primário por fluxo de adicionar papel administrativo/convidar de forma segura.
9. Atualizar testes, baseline candidate, documentação da task e executar validação local/remota autorizada no DEV.

## Ordem de Implementação

1. Mapper/tipos/StatusBadge e testes de contrato.
2. DbService (compliance viewer, settings, roles) e testes.
3. Migration e Edge Function de governança; aplicar somente no Supabase DEV após revisão local.
4. AdminApp: refresh, toast, ações e navegação.
5. AdminComponents: dashboard, filas, filtros, viewer, users/settings e responsividade.
6. Testes de UI/integração; lint; suíte; builds; browser smoke Cloudflare DEV.

## Testes Obrigatórios

- Contrato de todos os status reais e labels sem enum cru.
- Filtros Admin aceitam somente valores reais mais `ALL` e não usam `UNDER_REVIEW`.
- Refresh preserva conteúdo; falha preserva estado e produz feedback amigável.
- Viewer lida com PDF, imagem, URL indisponível e acesso negado sem expor path.
- Settings envia chaves permitidas e apenas PLATFORM_ADMIN salva; SUPPORT/usuário comum são bloqueados.
- Multi-role: adicionar role preserva role primária e demais roles; é idempotente; SUPPORT/autoelevAÇÃO/último admin são bloqueados; auditoria é registrada.
- Edge Function: JWT inválido, role indevida, e-mail inválido/duplicado e convite válido.
- Viewports 375, 390, 430, 768, 1280 e 1440 sem overflow de página.
- `npm run lint`, `npm test`, `npm run build:all`, `git diff --check`, CI e Database Baseline Verify.

## Riscos e Mitigações

- **RBAC/invite:** funções novas terão validação server-side e grants mínimos; nenhuma confiança em payload de frontend ou metadata.
- **Storage privado:** usar somente URL curta e RLS já verificada; nunca `getPublicUrl`.
- **Refresh:** preservar estado anterior e impedir requisições concorrentes duplicadas.
- **Regressão visual:** compor a tela com primitivas MAZZI existentes e validar por viewport/browsers.
- **Migrations:** forward-only, aplicar no DEV, registrar no baseline e nunca alterar ledger histórico.

## O que NÃO Alterar

- `main`, Production, Cloudflare PRD, Vercel/aliases PRD e pagamento real.
- Contratos de Student/PRO fora dos componentes compartilhados que precisarem de correção transversal.
- Bucket privado, RLS existente ou grants fora do escopo de viewer/governança.
- `admin_update_user_role` como caminho de preservação multi-role; ele não será reutilizado para esse fluxo.

## Instruções para o MAZZI Dev

Use componentes MAZZI existentes antes de criar qualquer JSX/CSS particular. Quando um padrão ainda não existir, crie uma primitiva compartilhada em `src/components/ui` com API reutilizável e atualize o Design System. Não exiba erros técnicos, enums, IDs, paths ou SQLSTATE. Todo controle de segurança permanece no banco/Edge Function; frontend apenas apresenta e envia intenções válidas.
