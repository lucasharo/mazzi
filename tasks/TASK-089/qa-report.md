# QA Report — TASK-089

TASK: TASK-089
STATUS: QA_APPROVED
OWNER: MAZZI QA
LAST_UPDATED: 2026-09-05

## 1. Veredito Final

APROVADO. A consolidação da disponibilidade do instrutor foi auditada no código, nos contratos automatizados, no Supabase DEV e no navegador DEV. Não foram encontrados bugs BLOCKER, CRITICAL ou HIGH nesta rodada.

## 2. Ambiente Auditado

- Branch `feature/premium-ui-v2`, estado local após `c37c293`.
- TypeScript strict, Vitest 4.1.10, Vite 6.4.3 e Node.js 22.
- Supabase DEV `bhvpkgonhlujmxvwnxix`.
- App PRO em `http://127.0.0.1:3002/`, conta de teste Carlos Eduardo Souza.

## 3. Avaliação dos Critérios de Aceite

- **AC01–AC18**: PASS — fluxo Student/PRO, matching, agenda, pagamento, tracking, lifecycle, privacidade, RLS e builds preservados pelos testes de contrato e regressão.
- **AC19**: PASS — janela de 60 minutos, campos persistidos, limite estrito em `online_expires_at > NOW()` e testes de 10:59/11:00.
- **AC20**: PASS — refresh, GPS, aceite, recusa e salvamento não chamam a mutação de ativação; reativação explícita chama a RPC única e cria novo início/expiração.
- **AC21**: PASS — matching exige status manual vigente, elegibilidade atual, veículo ACTIVE e `instant_enabled`; expiração não altera a configuração do carro.
- **AC22**: PASS — chave canônica por provider/instrutor, isolamento de autoescola e um único toggle/RPC por ação.

## 4. Happy Path

- O app PRO carregou no navegador DEV.
- O card Aula Agora mostrou `Disponível por mais 6 min.` e o botão `Configurar`.
- O modal mostrou uma única disponibilidade do instrutor e dois veículos independentes, cada um com seu próprio switch de habilitação.
- O contador e a derivação do estado usam a expiração retornada pelo backend; não há renovação pelo timer.

## 5. Caminhos Negativos e Limites

- Status online sem `online_expires_at` falha fechado e não aparece como disponível.
- À hora exata de expiração, o helper retorna indisponível e remove a mensagem de tempo restante.
- O backend reconcilia linhas expiradas para OFF e exige veículo Aula Agora elegível para nova ativação.
- Preço e distância continuam validados como centavos inteiros e limites inteiros, sem alteração da agenda.

## 6. Segurança e Isolamento RLS/RBAC

- A tabela canônica mantém RLS restritiva e política de negação de acesso direto.
- As RPCs da consolidação têm `SECURITY DEFINER`, `search_path` fixo, verificação de `auth.uid()`/membro e grants somente para `authenticated`; `anon` não executa.
- O estado continua isolado por `provider_id + instructor_id`; o administrador da autoescola não liga/desliga outro instrutor.
- O legacy `provider_instant_settings.instant_online` não é consultado como autoridade de matching.

## 7. Responsividade e Mobile First

No navegador DEV, as larguras 375, 390 e 430 px foram verificadas com `scrollWidth === innerWidth`, sem overflow horizontal. Os controles existentes mantêm targets mínimos de 44 px.

## 8. Acessibilidade

O modal e a disponibilidade usam headings/regions, label acessível no switch, estado nativo de checkbox, foco visível e controles reutilizáveis do design system. Ações de botão permanecem com `type="button"`.

## 9. Regressão

- 145 arquivos de teste e 952 testes aprovados.
- Testes focados Aula Agora: 4 arquivos e 38 testes aprovados.
- `npm run lint` e `npm run build:all` aprovados.
- Build Student, Instructor, Admin e Landing aprovados.
- `git diff --check` aprovado.

## 10. Bugs Encontrados

Nenhum bug BLOCKER, CRITICAL, HIGH ou MEDIUM encontrado. O único ajuste durante a auditoria foi atualizar um fixture antigo para fornecer `onlineExpiresAt`, refletindo corretamente o contrato canônico.

## 11. Riscos Identificados

- O Supabase advisor ainda lista achados históricos fora do escopo da TASK-089, incluindo tabelas/RPCs antigas e índices não utilizados; nenhum deles remove a RLS da tabela canônica.
- ETA continua geodésico/conservador, conforme decisão vigente, e não deve ser comunicado como rota viária precisa.

## 12. Recomendação para o Tech Lead

Aprovar para merge. `MAZZI CI` e `MAZZI Database Baseline Verify` passaram no commit final `dc47c88`.
