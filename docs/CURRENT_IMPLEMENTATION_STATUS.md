# MAZZI — Current Implementation Status

## Configurações — centralização de preferências (2026-09-05)

- A entrada do Perfil agora se chama **Configurações** e abre a tela compartilhada de configurações no Aluno e no PRO.
- **Notificações** permanece como seção interna, reutilizando as preferências e o contrato de backend já existentes.
- Nenhum backend ou ambiente de Production foi alterado nesta mudança.

## TASK-092 — Preferências de notificações na central (2026-09-05)

- Aluno e PRO acessam a central de notificações pelo link do Perfil; os switches ficam dentro da central, com feedback de carregamento/erro.
- Preferências são persistidas por usuário em `user_notification_preferences`, com padrão habilitado para tipos sem registro.
- O backend bloqueia novas notificações explicitamente desabilitadas sem remover o histórico; RPCs, RLS e trigger foram aplicados somente no Supabase DEV `bhvpkgonhlujmxvwnxix`.
- Production permanece intocada.

## TASK-089 — janela de disponibilidade do instrutor (2026-09-05)

- Implementada a janela backend-owned de 1 hora com `online_since` e `online_expires_at` em `provider_instant_instructor_status`.
- Matching, preview e getters exigem `online_expires_at > NOW()`; expiração é reconciliada e não depende de job eventual.
- Refresh, GPS, aceite/recusa e salvamento de veículo não renovam a janela. Reativação explícita cria nova janela.
- Configuração por veículo (`instant_enabled`) permanece independente e o campo legado `instant_online` é apenas compatibilidade.
- Migration aplicada somente no Supabase DEV `bhvpkgonhlujmxvwnxix`; Production não foi alterada.

Atualização (2026-09-09): a migration `20260909173304_admin_configurable_instant_decline_cooldown.sql` passou a ocultar os valores e impedir nova oferta do mesmo aluno ao instrutor que recusou a oferta anterior. O período é configurável no Admin e inicia em 5 minutos.

**Última revisão**: 2026-09-01
*Nota: Este documento deve ser atualizado sempre que uma TASK alterar o estado de uma feature relevante.*

---

> TASK-086 local: o contrato de ganhos, navegação profunda e service worker foi implementado localmente. O registry/push E2E permanece pendente da configuração aprovada de FCM/Web Push no DEV; nenhuma mutação remota foi feita.

## 7. Atualização de implementação — 2026-09-06 (Aula Agora)

- TASK-095 (App Aluno): a Home foi reorganizada como dashboard/hub, com próxima aula compacta, cards separados para Aula Agora e Agendar Aula, métricas reais em grade 2×2 e Sua Jornada desabilitada como “Em breve”. A busca tradicional permanece intacta e só é aberta pelo fluxo Agendar Aula; a navegação inferior foi renomeada para Início e usa ícone de grade.
- O card resumido do Aula Agora no PRO foi compactado, mantendo destaque visual e alinhamento com o padrão do App Aluno.
- O painel de ocorrências foi removido do modal de configuração do PRO; a operação administrativa continua disponível no painel de disputas.
- Os textos do card agora usam os parâmetros administráveis `max_eta_minutes` e `offer_expiration_seconds`, exibidos como “Deslocamento máximo” e “A oferta expira em”.
- O Admin pode configurar esses dois parâmetros; a atualização é protegida por permissão, auditada em `audit_logs` e consumida pelos RPCs de opções de preço e dispatch do matching.
- A configuração por veículo não possui mais botão Salvar: o switch é a única ação. Ao ativar, preço e distância ficam bloqueados; ao desativar, ficam editáveis e são persistidos automaticamente ao sair do campo.
- A migration `20260906020329_task_093_instant_platform_config.sql` foi aplicada e validada no projeto Supabase DEV `bhvpkgonhlujmxvwnxix`. Production permanece intocada.
- A migration corretiva `20260906174522_task_093_fix_instant_request_dispatch_alias.sql` remove a ambiguidade `42702` do dispatch chamado na criação de uma solicitação Aula Agora.
- A tela de configurações foi reorganizada com cabeçalho próprio e card de notificações responsivo; o conteúdo não fica mais limitado a `460px` no PRO e rola dentro do modal quando necessário.

## 7. TASK-089 — Aula Agora — 2026-09-03

Atualização local TASK-090 (2026-09-04): wizard implementado com três etapas
(endereço, câmbio, valor), B automática, seleção explícita de teto, voltar com
respostas preservadas ao voltar dentro do wizard. Cada reabertura reinicia o
processo mantendo somente o último endereço confirmado por usuário. Fundo branco aprovado;
progresso sem rótulos visíveis. Consulta de preços apenas na última etapa,
proteção de duplo envio e recuperação de erro. Pagamento/tracking preservados.
Validação anterior ao último ajuste cosmético: 888 testes, lint e quatro builds
aprovados. Conferência real local de endereço e câmbio em 390px; a homologação
integral do fluxo continua sendo acompanhada sem alegação de READY_FOR_RELEASE.

Foi implementada localmente a jornada de Aula Agora para Student e PRO: configuração por oferta, matching PostGIS em ondas, preço livre do PRO em centavos, aceite atômico no booking existente, notificações contextuais e tracking pós-match com o mapa Leaflet já utilizado pelo produto. As mudanças de disponibilidade canônica foram aplicadas e verificadas no Supabase DEV; Production permanece intocada.

O dashboard do PRO também exibe o estado da Aula Agora e abre diretamente sua configuração, mantendo a ativação, pausa e disponibilidade online no painel de gestão existente.

Atualização de disponibilidade por veículo (2026-09-05): a configuração do PRO agora exibe somente veículos `ACTIVE` na Gestão, mantém a habilitação de Aula Agora independente por carro e apresenta um único controle para a disponibilidade geral do instrutor. A migration `20260905221636_instant_vehicle_visibility.sql` foi aplicada e verificada no Supabase DEV; ofertas pendentes vinculadas a um carro desativado são expiradas sem alterar os demais veículos.

Atualização canônica (2026-09-05): o status online passou a ser persistido em `provider_instant_instructor_status` por `provider_id + instructor_id`, com um único RPC atômico e autorização para o próprio instrutor. As migrations `20260905232254_task_089_canonical_instructor_availability.sql` e `20260905232401_task_089_canonical_status_rls.sql` foram aplicadas e verificadas no Supabase DEV. O matching avalia todos os veículos elegíveis antes de escolher um por instrutor, deduplica ondas por instrutor e revalida o veículo no aceite; a agenda permanece separada e Production permanece intocada.

TASK-094 (2026-09-06): o RPC canônico agora permite que usuários autorizados da mesma autoescola alterem individualmente o status Aula Agora de instrutores vinculados, mantendo o instrutor autônomo restrito ao próprio usuário. A janela de 1 hora, o vínculo por tenant, a elegibilidade dos veículos, o matching e a independência dos carros foram preservados. Cada alteração registra `actor_id`, estado anterior e novo estado em `audit_logs`. A migration `20260906194822_task_094_school_controls_instant_instructor_status.sql` foi aplicada e verificada somente no Supabase DEV `bhvpkgonhlujmxvwnxix`; Production permanece intocada.

## 1. Separação de Responsabilidades da Documentação

Para evitar divergências entre planejamento, arquitetura e código funcional:

- [`MVP_RULES.md`](./product/MVP_RULES.md): Especifica **O QUE** o produto pretende e decidiu para o MVP.
- [`PRODUCT_DECISIONS.md`](./product/PRODUCT_DECISIONS.md): Registra formalmente as **decisões de produto aprovadas** (`DEC-001` a `DEC-013`).
- [`ARCHITECTURE.md`](./architecture/ARCHITECTURE.md): Detalha **COMO** a arquitetura técnica e o sistema estão estruturados.
- [`CURRENT_IMPLEMENTATION_STATUS.md`](./CURRENT_IMPLEMENTATION_STATUS.md): Retrato fiel e auditado do **QUE ESTÁ REALMENTE IMPLEMENTADO AGORA** no código-fonte.

---

## 2. Taxonomia Canônica de Status

Toda funcionalidade deve ser classificada exclusivamente por um dos seguintes status:

1. **`IMPLEMENTADO`**: Código funcional existente, testado e integrado ponta a ponta no backend/frontend.
2. **`PARCIAL`**: Base funcional existente, mas fluxo ainda necessita de integração final ou complementação.
3. **`MOCK/DEV`**: Implementação funcional restrita a ambientes de teste, sandbox ou desenvolvimento local.
4. **`PENDENTE`**: Funcionalidade pertencente ao escopo do MVP, mas ainda não iniciada/concluída.
5. **`FUTURO`**: Funcionalidade explicitamente congelada fora da versão pública atual.
6. **`DECISÃO PENDENTE`**: Regra de negócio ou fluxo aguardando definição formal de Product.

---

## 3. Matriz de Status da Plataforma MAZZI

### 3.1. Identidade, Autenticação e Perfil

| Área | Feature | Status | Evidência | Observações |
|---|---|---|---|---|
| Autenticação | Autenticação Supabase (Email/Senha) | `IMPLEMENTADO` | [`src/lib/auth-service.ts`](../src/lib/auth-service.ts), [`src/components/auth/AppLogin.tsx`](../src/components/auth/AppLogin.tsx) | Login com e-mail e senha via Supabase Auth GoTrue |
| Onboarding | Cadastro público de Alunos | `IMPLEMENTADO` | [`src/components/auth/AppLogin.tsx`](../src/components/auth/AppLogin.tsx) | Criação de perfil `STUDENT` com validação de campos |
| Verificação | Código OTP por e-mail | `IMPLEMENTADO` | [`src/lib/auth-constants.ts`](../src/lib/auth-constants.ts), [`src/components/ui/OtpInput.tsx`](../src/components/ui/OtpInput.tsx) | Confirmação de conta e redefinição via código de 8 dígitos (`/^\d{8}$/`) |
| Recuperação | Reset de senha anti-enumeração | `IMPLEMENTADO` | [`src/components/auth/AppLogin.tsx`](../src/components/auth/AppLogin.tsx), `supabase/migrations/20260818000033_disable_email_account_enumeration.sql` | Exibe mensagem canônica genérica para qualquer e-mail válido sem pre-check ou vazamento de existência (`DEC-011`) |
| Identidade | CPF do Aluno (Validação e Imutabilidade) | `IMPLEMENTADO` | [`src/utils/cpf.ts`](../src/utils/cpf.ts), `supabase/migrations/20260818000031_student_identity_mandatory_and_editable_birth_date.sql` | Obrigatório para `STUDENT`, validado via Módulo 11 no banco/UI, único e estritamente imutável |
| Identidade | Data de Nascimento (Idade >= 18 anos) | `IMPLEMENTADO` | [`src/utils/age.ts`](../src/utils/age.ts), `supabase/migrations/20260818000031_student_identity_mandatory_and_editable_birth_date.sql` | Obrigatória para `STUDENT`, idade civil >= 18 anos validada no banco e editável no Perfil via RPC |
| Perfil | Perfil do Aluno (Visualização e Edição) | `IMPLEMENTADO` | [`src/apps/student/StudentApp.tsx`](../src/apps/student/StudentApp.tsx), [`src/lib/db-service.ts`](../src/lib/db-service.ts) | Exibe CPF mascarado (`***.***.***-XX`); permite editar Nome, Telefone, Foto e Data de Nascimento |
| Perfil | RPC `update_my_profile` Hardening | `IMPLEMENTADO` | `supabase/migrations/20260818000032_harden_update_my_profile_and_reconcile_migrations.sql` | RPC `SECURITY DEFINER`, `search_path = public, pg_temp`, `RETURNS void`, sem vazamento de dados |
| Perfil | Foto de Perfil / Avatar Upload | `IMPLEMENTADO` | [`src/components/profile/ProfilePhotoPicker.tsx`](../src/components/profile/ProfilePhotoPicker.tsx), `supabase/migrations/20260817000027_storage_avatars_bucket.sql` | Storage bucket `avatars` com RLS |
| Ferramental Dev | DevQuickLogin (Hardened / Sem Senhas Versionadas) | `MOCK/DEV` | [`src/components/auth/dev/DevQuickLogin.tsx`](../src/components/auth/dev/DevQuickLogin.tsx), [`src/components/auth/dev/demo-accounts.ts`](../src/components/auth/dev/demo-accounts.ts) | Lista mantida em DEV (`DEV=true` + `VITE_ENABLE_DEV_QUICK_LOGIN="true"`), sem senhas versionadas; credenciais rotacionadas e lidas exclusivamente do `.env.local` (`DEC-012`) |
| Infra / CI | GitHub Actions CI Workflow (`MAZZI CI`) | `IMPLEMENTADO` | [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | Automação de lint, testes, build dos quatro apps e publicação DEV no Cloudflare Pages para pushes em `feature/premium-ui-v2` |

---

### 3.2. App Aluno (Student Journey)

| Área | Feature | Status | Evidência | Observações |
|---|---|---|---|---|
| Oferta Pública | Categoria B (Automóvel) | `IMPLEMENTADO` | [`src/apps/student/StudentApp.tsx`](../src/apps/student/StudentApp.tsx), [`docs/product/PRODUCT_DECISIONS.md`](./product/PRODUCT_DECISIONS.md) (`DEC-008`) | Categoria pública padrão e ativa para busca no App Aluno |
| Oferta Pública | Categoria A (Motocicleta) | `FUTURO` / `PREPARADA TECNICAMENTE` | [`src/types/index.ts`](../src/types/index.ts), [`src/domain/search.ts`](../src/domain/search.ts) | Tipos e modelos preparados tecnicamente; oculta da seleção pública no MVP inicial |
| Busca | Busca Geoespacial e Raio em KM | `IMPLEMENTADO` | [`src/domain/search.ts`](../src/domain/search.ts), `supabase/migrations/20260814000008_search_postgis.sql` | Cálculo de distância PostGIS com matching estrito |
| Filtros | Filtros de Categoria, Transmissão, Data e Horário | `IMPLEMENTADO` | [`src/components/search/FilterDrawer.tsx`](../src/components/search/FilterDrawer.tsx) | Matching estrito de prestadores que atendam 100% dos filtros |
| Visualização | Lista e Mapa Interativo | `IMPLEMENTADO` | [`src/components/search/MapView.tsx`](../src/components/search/MapView.tsx) | Alternância fluida entre visualização em lista e mapa |
| Prestador | Perfil Público do Prestador | `IMPLEMENTADO` | [`src/components/search/ProviderPublicProfileModal.tsx`](../src/components/search/ProviderPublicProfileModal.tsx) | Exibe detalhes, foto, avaliações e frota do profissional |
| Agenda | Seleção de Horários (Horizonte configurável) | `IMPLEMENTADO` | [`src/domain/platform-config.ts`](../src/domain/platform-config.ts), [`src/apps/student/components/SlotSelectorModal.tsx`](../src/apps/student/components/SlotSelectorModal.tsx), [`src/apps/provider/components/ProviderScheduleTab.tsx`](../src/apps/provider/components/ProviderScheduleTab.tsx), `supabase/migrations/20260908045839_public_platform_configuration.sql` | Aluno e PRO consultam o horizonte público configurado no Admin e carregam progressivamente em lotes técnicos de até 30 dias; no ambiente real, configuração ausente ou inválida bloqueia a consulta. |
| Pagamentos | Gateway Fake | `PADRÃO/DEV` | [`src/domain/payments/fake-adapter.ts`](../src/domain/payments/fake-adapter.ts), [`src/apps/student/components/CheckoutModal.tsx`](../src/apps/student/components/CheckoutModal.tsx) | Simulação de PIX e Cartão, sem movimentação financeira (`DEC-010`) |
| Pagamentos | Stripe | `IMPLEMENTADO / HOMOLOGAÇÃO` | [`src/apps/student/components/StripeHostedCheckout.tsx`](../src/apps/student/components/StripeHostedCheckout.tsx), Edge Functions `create-stripe-checkout-session`, `stripe-webhook`, `process-automatic-stripe-payouts` e `process-stripe-refund` | Cartão e Pix usam Checkout hospedado externo; valores vêm do banco, metadata vincula sessão/pagamento/reserva, o webhook assinado confirma a reserva e o Admin solicita estornos idempotentes. O MAZZI cria a transferência Connect após a liberação e deixa o payout bancário seguir o cronograma automático da Stripe. |
| Minhas Aulas | Gestão de Aulas Agendadas e Histórico | `IMPLEMENTADO` | [`src/apps/student/components/BookingDetailsModal.tsx`](../src/apps/student/StudentApp.tsx) | Exibe aulas ativas, concluídas e detalhes da reserva |
| Cancelamento | Fluxo Comercial de Cancelamento | `IMPLEMENTADO` | [`src/domain/cancellation.ts`](../src/domain/cancellation.ts), `supabase/migrations/20260818000034_cancellation_flow_and_rpc.sql` | Tabela canônica DEC-013 (100% >=24h, 50% 6-24h, 0% <6h), RPC `cancel_booking_v2`, modal no App Aluno e modo Read-Only no Chat |
| Comunicação | Chat Contextual por Aula | `IMPLEMENTADO` | [`src/components/chat/BookingChatPanel.tsx`](../src/components/chat/BookingChatPanel.tsx), `supabase/migrations/20260817000019_student_realtime_chat.sql` | Mensageria associada à reserva confirmada com Supabase Realtime |
| Feedback | Avaliação do Prestador (1-5 Estrelas) | `IMPLEMENTADO` | [`src/components/reviews/ReviewModal.tsx`](../src/components/reviews/ReviewModal.tsx) | Avaliação didática, pontualidade, segurança e cordialidade |
| Notificações | Painel de Notificações em Tempo Real | `IMPLEMENTADO` | [`src/components/notifications/NotificationsPanel.tsx`](../src/components/notifications/NotificationsPanel.tsx), migration `lesson_concurrency_and_notifications` | Notificações de confirmação, check-in de cada participante, início e conclusão da aula |

---

### 3.3. Portal do Prestador e Admin

| Área | Feature | Status | Evidência | Observações |
|---|---|---|---|---|
| Prestador | Portal do Prestador (`src/apps/provider/`) | `IMPLEMENTADO` | [`src/apps/provider/`](../src/apps/provider/) | Gestão de perfil, horários de disponibilidade, veículos e ofertas |
| Prestador | Onboarding Stripe Connect hospedado iniciado pelo MAZZI | `IMPLEMENTADO / HOMOLOGAÇÃO DEV` | [`src/apps/provider/components/ProviderAccountTab.tsx`](../src/apps/provider/components/ProviderAccountTab.tsx), Edge Function `create-stripe-connect-account`, [`docs/product/PRODUCT_DECISIONS.md`](./product/PRODUCT_DECISIONS.md) (`DEC-017`) | O MAZZI cria a conta Connect e abre um Account Link de uso único hospedado pela Stripe; no retorno sincroniza capacidades e exibe apenas o resumo bancário mascarado que a Stripe devolver. Production permanece intocada |
| Compliance | Gestão de Documentação Regulatória | `IMPLEMENTADO` | [`src/domain/compliance.ts`](../src/domain/compliance.ts) | Upload e moderação de CNH, CRLV, alvarás e inspeções |
| Frota | Cadastro de Veículos e Transmissões | `IMPLEMENTADO` | [`src/domain/vehicles-offerings.ts`](../src/domain/vehicles-offerings.ts), migration `enforce_active_offering_requirements` | Homologação de veículos com pedal duplo e categoria; ofertas são automaticamente desativadas quando deixam de cumprir os requisitos, inclusive após desativação do veículo |
| Admin | Painel Administrativo (`src/apps/admin/`) | `IMPLEMENTADO` | [`src/apps/admin/`](../src/apps/admin/), [`src/entrypoints/admin/AdminRoot.tsx`](../src/entrypoints/admin/AdminRoot.tsx), migration `20260828023332_pix_receiving_and_manual_payouts` | MVP restrito a `PLATFORM_ADMIN`, leituras fail-closed, revisão de compliance alinhada à permissão canônica, configuração de taxas, estorno Stripe via Edge Function e repasse manual. Transferência automática permanece futura. |
| Auditoria | Registro Estruturado de Logs (`AuditLog`) | `IMPLEMENTADO` | `supabase/migrations/20260815000015_sprint15_security_hardening.sql` | Tabela `audit_logs` registrando ações críticas de sistema |

### 3.4. Premium UI V2 e Design System

| Área | Feature | Status | Evidência | Observações |
|---|---|---|---|---|
| Componentes globais | Headers, navegação, botões e estados compartilhados | `IMPLEMENTADO` | [`src/components/ui/`](../src/components/ui/), [`src/index.css`](../src/index.css) | Aluno, PRO e Admin compartilham tokens e componentes sem overrides tipográficos específicos por app |
| Botões | Small buttons, ícones e variantes de cancelamento | `IMPLEMENTADO` | [`src/components/ui/Button.tsx`](../src/components/ui/Button.tsx), [`src/components/ui/ButtonActionIcon.tsx`](../src/components/ui/ButtonActionIcon.tsx) | `sm` é o padrão; cancelamento intermediário usa Danger Soft e confirmação final usa Danger Solid com `XCircle` |
| Feedback | Estados vazios globais para lista e objeto | `IMPLEMENTADO` | [`src/components/ui/ListEmptyState.tsx`](../src/components/ui/ListEmptyState.tsx), [`src/components/ui/ObjectEmptyState.tsx`](../src/components/ui/ObjectEmptyState.tsx) | Mesmo markup e tipografia em todos os apps |
| Design System | Catálogo executável alinhado aos entrypoints Aluno/PRO | `IMPLEMENTADO` | [`src/apps/design-system/DesignSystemShowcase.tsx`](../src/apps/design-system/DesignSystemShowcase.tsx), [`docs/DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) | Inventário de 21 componentes públicos, referência do Aluno, abas reais e fluxo real de dias/horários com dados isolados |
| Agendamento visual | Calendário e seleção de horários no catálogo | `IMPLEMENTADO` | [`src/apps/student/components/SlotSelectorModal.tsx`](../src/apps/student/components/SlotSelectorModal.tsx) | O modo de preview é opcional e não substitui a consulta real ao backend no produto |

| Autoescola ↔ Instrutor | Convites, vínculo, compliance por escopo, elegibilidade e recontratação | `IMPLEMENTADO` | Migrations `20260821211805`, `20260821211815`, `20260821212128`, `20260821212131`, `20260821212134`, `20260821212313`, `20260821212317`, `20260821212518`, `20260821212857`, `20260821213335`, `20260821213422`, `20260821213516`; RPCs seguras e painel mínimo no MAZZI Pro | Backend LIVE aplicado; pagamentos DEV usam Stripe de teste e o fake é somente local |

---

## 4. Próximos Passos Recomendados

1. **Operação e observabilidade (`Dev`):** acompanhar a execução do fluxo já implementado de cancelamento DEC-013 e do ciclo Autoescola ↔ Instrutor.
2. **Gateway de pagamento (`Product/Dev`):** Stripe está configurado para cartão e Pix no checkout customizado; fake permanece disponível somente como fallback explícito para testes locais. O webhook assinado, as credenciais Stripe e as Edge Functions de criação/estorno estão publicados no Supabase; produção exige apenas a troca controlada para chaves `pk_live_`/`sk_live_` após homologação.
3. **Publicação (`Dev`):** acompanhar o workflow GitHub Actions e os quatro projetos Cloudflare Pages DEV após cada push da branch `feature/premium-ui-v2`.

---

## 5. Atualização de implementação — 2026-08-30 e 2026-08-31

O histórico detalhado das alterações realizadas nos dois últimos dias está em [`docs/23-change-log-2026-08-30-31.md`](./23-change-log-2026-08-30-31.md). Em resumo, foram concluídos:

- migração do checkout do Mercado Pago para Stripe Checkout hospedado, com métodos dinâmicos, retorno controlado e confirmação server-side por webhook;
- correções no fluxo de pagamento pendente, retomada de reserva sem criar novo hold e reaproveitamento da mesma prévia do fluxo de reservar agenda;
- perfil do prestador aberto a partir do mapa e compactação da tela de resumo da reserva;
- autocomplete de endereço reutilizável, modal independente, localização atual, edição de rua/número e confirmação exclusivamente por seleção da lista;
- padronização visual dos headers, labels, sombras, cores, telas de sucesso e estados de checkout;
- atualização da suíte de segurança para validar a retomada de pagamento pela prévia compartilhada.

## 7. Atualização de implementação — 2026-09-07 — Aula Agora

- Política específica de cancelamento e reembolso implementada no DEV pela migration `20260907211534_instant_aula_agora_cancellation_refund_policy`.
- Prévia e cancelamento final usam RPCs server-side com lock da reserva, fonte `AULA_AGORA`, pagamento fake/mock, idempotência, auditoria e snapshot de timestamps/configuração.
- Faixas padrão: 100% antes da saída, 90% até 3 minutos a caminho, 80% entre 3 e 7 minutos, 70% após 7 minutos sem chegada, 60% após chegada; aula iniciada segue o lifecycle normal e não aceita este cancelamento.
- A Agenda permanece em `cancel_booking_v2`/DEC-013. Ativação comercial da política exige `REQUIRES_REGULATORY_VALIDATION`.

## 6. Atualização de implementação — 2026-09-01

O histórico consolidado desta frente está em [`docs/24-chat-history-2026-09-01.md`](./24-chat-history-2026-09-01.md). Foram concluídos:

- preservação do histórico de mensagens da contestação, incluindo solicitações do Admin e autoria correta;
- fluxo de evidências com armazenamento privado, leitura por URLs assinadas e restrição por participante;
- prazo configurável de resposta da contestação e bloqueio de envio no chat regular durante a análise;
- painel dedicado de contestação no Admin, separado do Financeiro, com dados amigáveis da reserva;
- analytics com atualização global, rótulos em português e checkouts cancelados;
- calendário do Aluno conectado ao horizonte configurado no Admin, com carregamento progressivo e bloqueio seguro quando a configuração real não está disponível;
- compactação visual do calendário, horários e resumo da seleção para reduzir o scroll em telas móveis.
> TASK-086 local: o contrato de ganhos, navegação profunda e service worker foi implementado localmente. O registry/push E2E permanece pendente da configuração aprovada de FCM/Web Push no DEV; nenhuma mutação remota foi feita.
