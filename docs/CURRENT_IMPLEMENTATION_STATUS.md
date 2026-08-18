# MAZZI — Current Implementation Status

**Última revisão**: 2026-08-18  
*Nota: Este documento deve ser atualizado sempre que uma TASK alterar o estado de uma feature relevante.*

---

## 1. Separação de Responsabilidades da Documentação

Para evitar divergências entre planejamento, arquitetura e código funcional:

- [`MVP_RULES.md`](./product/MVP_RULES.md): Especifica **O QUE** o produto pretende e decidiu para o MVP.
- [`PRODUCT_DECISIONS.md`](./product/PRODUCT_DECISIONS.md): Registra formalmente as **decisões de produto aprovadas** (`DEC-001` a `DEC-009`).
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
| Verificação | Código OTP por e-mail | `IMPLEMENTADO` | [`src/components/ui/OtpInput.tsx`](../src/components/ui/OtpInput.tsx) | Confirmação de conta e redefinição via código de 6 dígitos |
| Recuperação | Reset de senha anti-enumeração | `IMPLEMENTADO` | [`src/components/auth/AppLogin.tsx`](../src/components/auth/AppLogin.tsx), `supabase/migrations/20260818000033_disable_email_account_enumeration.sql` | Exibe mensagem canônica genérica para qualquer e-mail válido sem pre-check ou vazamento de existência (`DEC-011`) |
| Identidade | CPF do Aluno (Validação e Imutabilidade) | `IMPLEMENTADO` | [`src/utils/cpf.ts`](../src/utils/cpf.ts), `supabase/migrations/20260818000031_student_identity_mandatory_and_editable_birth_date.sql` | Obrigatório para `STUDENT`, validado via Módulo 11 no banco/UI, único e estritamente imutável |
| Identidade | Data de Nascimento (Idade >= 18 anos) | `IMPLEMENTADO` | [`src/utils/age.ts`](../src/utils/age.ts), `supabase/migrations/20260818000031_student_identity_mandatory_and_editable_birth_date.sql` | Obrigatória para `STUDENT`, idade civil >= 18 anos validada no banco e editável no Perfil via RPC |
| Perfil | Perfil do Aluno (Visualização e Edição) | `IMPLEMENTADO` | [`src/apps/student/StudentApp.tsx`](../src/apps/student/StudentApp.tsx), [`src/lib/db-service.ts`](../src/lib/db-service.ts) | Exibe CPF mascarado (`***.***.***-XX`); permite editar Nome, Telefone, Foto e Data de Nascimento |
| Perfil | RPC `update_my_profile` Hardening | `IMPLEMENTADO` | `supabase/migrations/20260818000032_harden_update_my_profile_and_reconcile_migrations.sql` | RPC `SECURITY DEFINER`, `search_path = public, pg_temp`, `RETURNS void`, sem vazamento de dados |
| Perfil | Foto de Perfil / Avatar Upload | `IMPLEMENTADO` | [`src/components/profile/ProfilePhotoPicker.tsx`](../src/components/profile/ProfilePhotoPicker.tsx), `supabase/migrations/20260817000027_storage_avatars_bucket.sql` | Storage bucket `avatars` com RLS |
| Ferramental Dev | DevQuickLogin (Hardened / Sem Senhas Versionadas) | `MOCK/DEV` | [`src/components/auth/dev/DevQuickLogin.tsx`](../src/components/auth/dev/DevQuickLogin.tsx), [`src/components/auth/dev/demo-accounts.ts`](../src/components/auth/dev/demo-accounts.ts) | Lista mantida em DEV (`DEV=true` + `VITE_ENABLE_DEV_QUICK_LOGIN="true"`), sem senhas versionadas; credenciais rotacionadas e lidas exclusivamente do `.env.local` (`DEC-012`) |
| Infra / CI | GitHub Actions CI Workflow (`MAZZI CI`) | `IMPLEMENTADO` | [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | Automação de `npm ci`, `npm run lint`, `npm test` e `npm run build:all` em Node 20 para PRs e pushes |

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
| Agenda | Seleção de Horários (Horizonte 60 Dias) | `IMPLEMENTADO` | [`src/domain/availability.ts`](../src/domain/availability.ts), [`src/apps/student/components/SlotSelectorModal.tsx`](../src/apps/student/components/SlotSelectorModal.tsx) | `STUDENT_BOOKING_HORIZON_DAYS = 60` (carregamento progressivo 30+30 dias) |
| Pagamentos | Gateway Ativo Atual | `MOCK/DEV` | [`src/domain/payments/fake-adapter.ts`](../src/domain/payments/fake-adapter.ts), [`src/apps/student/components/CheckoutModal.tsx`](../src/apps/student/components/CheckoutModal.tsx) | `FakePaymentGateway` ativo no checkout para pagamentos simulados (PIX e Cartão), sem movimentação financeira real (`DEC-010`) |
| Pagamentos | Integração Mercado Pago | `FUTURO` / `PREPARADA TECNICAMENTE` | [`src/domain/payments/mercadopago-adapter.ts`](../src/domain/payments/mercadopago-adapter.ts), [`src/domain/payments/gateway-factory.ts`](../src/domain/payments/gateway-factory.ts) | Adaptadores e fábrica preparados no código-fonte; integração HTTP real ao vivo adiada (`DEC-010`) |
| Minhas Aulas | Gestão de Aulas Agendadas e Histórico | `IMPLEMENTADO` | [`src/apps/student/components/BookingDetailsModal.tsx`](../src/apps/student/StudentApp.tsx) | Exibe aulas ativas, concluídas e detalhes da reserva |
| Cancelamento | Fluxo Comercial de Cancelamento | `IMPLEMENTADO` | [`src/domain/cancellation.ts`](../src/domain/cancellation.ts), `supabase/migrations/20260818000034_cancellation_flow_and_rpc.sql` | Tabela canônica DEC-013 (100% >=24h, 50% 6-24h, 0% <6h), RPC `cancel_booking_v2`, modal no App Aluno e modo Read-Only no Chat |
| Comunicação | Chat Contextual por Aula | `IMPLEMENTADO` | [`src/components/chat/BookingChatPanel.tsx`](../src/components/chat/BookingChatPanel.tsx), `supabase/migrations/20260817000019_student_realtime_chat.sql` | Mensageria associada à reserva confirmada com Supabase Realtime |
| Feedback | Avaliação do Prestador (1-5 Estrelas) | `IMPLEMENTADO` | [`src/components/reviews/ReviewModal.tsx`](../src/components/reviews/ReviewModal.tsx) | Avaliação didática, pontualidade, segurança e cordialidade |
| Notificações | Painel de Notificações em Tempo Real | `IMPLEMENTADO` | [`src/components/notifications/NotificationsPanel.tsx`](../src/components/notifications/NotificationsPanel.tsx) | Notificações de confirmação, alteração de status e lembretes |

---

### 3.3. Portal do Prestador e Admin

| Área | Feature | Status | Evidência | Observações |
|---|---|---|---|---|
| Prestador | Portal do Prestador (`src/apps/provider/`) | `IMPLEMENTADO` | [`src/apps/provider/`](../src/apps/provider/) | Gestão de perfil, horários de disponibilidade, veículos e ofertas |
| Compliance | Gestão de Documentação Regulatória | `IMPLEMENTADO` | [`src/domain/compliance.ts`](../src/domain/compliance.ts) | Upload e moderação de CNH, CRLV, alvarás e inspeções |
| Frota | Cadastro de Veículos e Transmissões | `IMPLEMENTADO` | [`src/domain/vehicles-offerings.ts`](../src/domain/vehicles-offerings.ts) | Homologação de veículos com pedal duplo e categoria |
| Admin | Painel Administrativo (`src/apps/admin/`) | `IMPLEMENTADO` | [`src/apps/admin/`](../src/apps/admin/) | Credenciamento de profissionais, aprovação de documentos e analytics |
| Auditoria | Registro Estruturado de Logs (`AuditLog`) | `IMPLEMENTADO` | `supabase/migrations/20260814000015_sprint15_security_hardening.sql` | Tabela `audit_logs` registrando ações críticas de sistema |

---

## 4. Próximos Passos Recomendados

1. **Definição da Política Comercial de Cancelamento (`Product`)**: Formalizar taxas e prazos de reembolso em `PRODUCT_DECISIONS.md` para transicionar a funcionalidade de Cancelamento de `PARCIAL / DECISÃO PENDENTE` para `IMPLEMENTADO`.
2. **Homologação Final do Gateway de Pagamento (`Dev`)**: Substituir o adaptador Sandbox Mock pelo ambiente de staging real do Mercado Pago.
