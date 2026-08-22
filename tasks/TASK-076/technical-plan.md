# TASK-076 — Technical Plan

TASK: TASK-076
STATUS: TECH_READY
OWNER: MAZZI Tech Lead
LAST_UPDATED: 2026-08-22

## Resumo técnico

Implementar a closure em fatias independentes: Student booking context/offering, onboarding Auth/role, mapa, Supabase hardening/performance, Admin operations e homologação. Cada fatia terá testes próprios; nenhuma migration aplicada será editada.

## Arquivos existentes relacionados

- `src/apps/student/StudentApp.tsx`, `CheckoutModal.tsx`, `SlotSelectorModal.tsx`.
- `src/components/auth/AppLogin.tsx`, `AuthContext.tsx`, `src/lib/auth-service.ts`.
- `src/apps/admin/AdminApp.tsx`, `AdminComponents.tsx`, `src/lib/db-service.ts`.
- `src/components/search/MapView.tsx` e domínio de busca.
- `supabase/migrations/*`, especialmente RPCs públicas de busca/contexto, auth/RBAC, compliance, bookings e refund.

## Arquivos afetados

- `[MODIFY]` somente os módulos diretamente necessários em cada fatia.
- `[NEW]` migrations forward-only e testes correspondentes.
- `[NEW]` artefatos de workflow em `tasks/TASK-076/`.
- `[DELETE]` nenhum arquivo sem evidência de que é artefato temporário.

## Ordem de implementação

1. Auditar contratos LIVE, enums, funções, grants, policies e índices.
2. Corrigir seleção Student usando lista original de contexts e oferta como identidade final.
3. Implementar onboarding/role instructor com RPC segura e integração Auth existente.
4. Corrigir paginação limitada do mapa e race protection.
5. Criar migrations de segurança/performance somente após comparar definições LIVE.
6. Implementar RPCs Admin para provider lifecycle, refund fake e role management.
7. Adicionar testes unitários, de contrato, segurança e integração possível sem fixtures destrutivas.
8. Executar browser homologation com browser automation nos aliases/ambiente local.
9. Aplicar somente migrations novas pendentes, validar advisor e runtime.
10. Criar commit(s), push, acompanhar CI, fazer Preview deployments e reaplicar aliases existentes.

Decisões implementadas: o onboarding usa `onboard_my_instructor()` de forma idempotente e o provider inicia em `DRAFT`; o mapa usa `MAX_MAP_RESULTS = 50`.

## Restrições de segurança

- Toda mutação sensível passa por RPC transacional com `auth.uid()`, `SECURITY DEFINER` justificado, `SET search_path = public, pg_temp`, RBAC e auditoria.
- Não usar service role no frontend.
- Não conceder policies permissivas para silenciar Advisor.
- Não usar SQL manual de UPDATE para mascarar erro de fluxo.
- Não alterar histórico LIVE nem migrations já aplicadas.

## Testes obrigatórios

- `npm test`, `npm run lint`, `npm run build:all`, `git diff --check`.
- Regressões Student para contexts/ofertas/slots/checkout.
- Auth/OTP/CPF/idade/role/convite e negative tests.
- Mapa com 25+ resultados, filtros concorrentes e dedupe.
- ACL/RLS/RBAC e idempotência das operações Admin.
- Supabase LIVE: histórico, funções, grants, policies, advisors e RPC smoke.
- Browser mobile 390x844 e desktop para Student, PRO e Admin.

## O que não alterar

Pagamento real, Mercado Pago, categorias futuras, veículo do aluno, pacotes, gamificação, integrações governamentais, PostGIS/schema de extensões, redesign aprovado e refatoração estrutural ampla.
