# QA Report — TASK-093

TASK: TASK-093  
STATUS: QA_APPROVED_WITH_RESERVATIONS  
OWNER: MAZZI QA  
LAST_UPDATED: 2026-09-09

## 1. Veredito final

**APROVADO COM RESSALVAS para validação funcional em DEV; não liberado para produção.**

O contrato específico do termo v2, a migration DEV, o gate server-side, a preservação histórica e o fluxo de aceite passaram na validação automatizada/estática e na inspeção direta do Supabase DEV. Permanecem ressalvas de revisão jurídica, ausência de E2E Chromium neste workspace e falhas globais preexistentes fora do escopo da task.

## 2. Ambiente auditado

- Node.js / Vitest 4.1.10 / TypeScript.
- Build Vite Student, Instructor, Admin e Landing.
- Supabase DEV `bhvpkgonhlujmxvwnxix`.
- Chromium/E2E: não executado; `@playwright/test` não está instalado no workspace.

## 3. Avaliação dos critérios de aceite

- **AC01: PASS** — v2/2.0 está no bundle local, com texto integral, hash estável e sem URL externa.
- **AC02: PASS** — visualizador abre o conteúdo antes do aceite e renderiza todas as seções.
- **AC03: PASS** — checkbox começa desmarcado e o CTA exige aceite explícito.
- **AC04: PASS** — migration/RPC gravam provider, user, versão, hash e `accepted_at` server-side.
- **AC05: PASS COM RESSALVA** — retry sequencial retorna o documento corrente existente; concorrência real não foi exercitada sem E2E autenticado.
- **AC06: PASS** — consulta DEV confirmou um aceite histórico `v1` preservado; não houve backfill para v2.
- **AC07: PASS NO CONTRATO** — RPC exige usuário autenticado/ativo, ownership/autorização e versão corrente; cliente não define hash/status.
- **AC08: PASS** — Gestão do PRO mostra versão/data, histórico e reabertura da versão corrente; o texto integral original v1 não existia no repositório para exibição sem inventar conteúdo.
- **AC09: PASS** — `is_provider_activation_eligible` remoto exige versão atual e hash canônico.
- **AC10: PASS NO CONTRATO** — `is_provider_owner` existente contempla proprietário e SCHOOL_ADMIN ativo autorizado; Student não foi integrado ao fluxo.
- **AC11: PASS ESTÁTICO** — headings, `aria-labelledby`, labels, estados disabled/loading e layout com scroll foram verificados no componente. Viewports 375/390/430px não foram testados no browser real.
- **AC12: PASS** — placeholders e marcador `LEGAL_ENTITY_DETAILS_REQUIRED_FOR_PRODUCTION` permanecem visíveis/documentados.

## 4. Fluxo principal

- `ProfessionalTermsViewer` inicia fechado e abre pelo card de Gestão.
- A leitura integral está disponível antes do aceite.
- O aceite chama `provider_accept_mazzi_terms` com `v2`.
- Após confirmação positiva, a tela recarrega workspace e exibe versão/data.
- Em falha de rede/backend, o modal permanece aberto e o alerta informa a falha.

## 5. Caminhos negativos

- Versão divergente é rejeitada por `TERMS_VERSION_NOT_CURRENT`.
- Usuário anônimo/inativo e provider sem autorização são rejeitados pelas guardas existentes da RPC.
- Hash/versionamento falso não é aceito pelo backend.
- Aceite não é inferido por abertura, scroll ou checkbox pré-marcado.

## 6. Segurança e RLS/RBAC

Consulta direta no DEV confirmou:

- `current_mazzi_terms_version()` retorna `v2`.
- RPC de aceite exige `is_provider_owner`, versão corrente e grava hash fixo.
- RPC de aceite tem `EXECUTE` para `authenticated`, sem grant para `anon`, `public` ou `service_role`.
- Gate de ativação confere `terms_version` e `document_hash`.
- Policies RLS de `compliance_documents` continuam presentes.

## 7. Responsividade e acessibilidade

Validação estática confirmou componentes reutilizáveis MAZZI, ícones SVG Lucide, botão com alvo mínimo do design system, heading por seção, label associado ao checkbox e área de conteúdo rolável. Falta validação visual no Chromium nos três viewports exigidos.

## 8. Regressão

- Testes específicos da task e contratos relacionados: **67/67 passando**.
- `npm run lint`: aprovado.
- `npm run build:all`: aprovado.
- A suíte global ainda registra falhas não relacionadas em `tests/map-follow-provider.test.tsx`, `tests/instant-lesson-category.test.tsx` e no teste live `tests/rpc-cancellation-v2-real.test.ts`. Esses problemas já existiam no contexto de trabalho e não são causados pelo termo v2.

## 9. Bugs encontrados

### BUG-001 — Suíte global fora do verde

- **Severidade**: HIGH para o gate geral; não relacionada ao fluxo de termos.
- **Passos**: executar `npm test`.
- **Esperado**: todos os testes passarem.
- **Atual**: falhas nos testes de mapa/wizard e uma integração live RPC.
- **Evidência**: execução global terminou com 154 arquivos passando e falhas nos grupos acima; os testes focados da TASK-093 passaram.

### BUG-002 — E2E Chromium indisponível no workspace

- **Severidade**: MEDIUM, bloqueia somente a validação manual exigida.
- **Passos**: verificar `npm ls @playwright/test playwright`.
- **Atual**: dependência não instalada.

## 10. Riscos

- O conteúdo precisa de revisão jurídica e preenchimento dos dados empresariais antes de produção.
- Não se deve aplicar a migration em produção nesta etapa.
- A ausência do texto integral v1 limita a consulta histórica desse conteúdo antigo; os registros e metadados v1 continuam preservados.

## 11. Recomendação ao Tech Lead

Aprovar a implementação para testes funcionais no DEV e devolver para validação visual/negativa autenticada quando o ambiente E2E estiver disponível. Manter a task fora de produção até revisão jurídica, placeholders preenchidos e saneamento/triagem das falhas globais da suíte.
